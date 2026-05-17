/**
 * OriginalQueryEngineBridge — 桥接 AgentEngine 到 Claude Code 原始 QueryEngine
 *
 * 职责：
 * 1. initializeRuntime() — 注入 MACRO defines、enableConfigs、bootstrap 单例
 * 2. buildQueryEngineConfig() — 从 AgentEngine 配置构造 QueryEngineConfig
 * 3. adaptToolExtension() — ToolExtension → Claude Code Tool 类型适配
 *
 * V18 优化：
 * - 使用 UnifiedConfig 替代 BridgeOptions，消除 as any 类型断言
 * - 配置转换类型安全
 */

import {LogUtil} from 'src/engine/log'

const log = LogUtil.getInstance().child('EngineBridge')
import type {QueryEngineConfig} from '../../QueryEngine.js'
import type {Tools, Tool, ToolUseContext, ToolInputJSONSchema} from '../../Tool.js'
import type {Message, AssistantMessage} from '../types/message.js'
import type {Command} from '../types/command.js'
import type {CanUseToolFn} from '../types/permissions.js'
import {z} from 'zod'
import type {CCRuntime} from '../cc-runtime/CCRuntime.js'
import {getGlobalCCRuntime} from '../cc-runtime/DefaultCCRuntime.js'
import type {CoreAppState} from '../types/CoreAppState.js'
import {createDefaultCoreAppState} from '../state/CoreAppStateFactory.js'
import type {PermissionDelegate} from '../permissions/PermissionDelegate.js'
import type {UnifiedConfig} from '../config/UnifiedConfig.js'
import {getGlobalProviderRegistry} from '../provider/ProviderRegistry.js'
import type {ProviderAdapter} from '../provider/ProviderAdapter.js'
import type {QueryDeps} from '../../query/deps.js'
import {productionDeps} from '../../query/deps.js'
import {EngineError, EngineErrorCode} from '../errors.js'
import type {SDKTool} from '../types/tool-extension.js'

// ============================================================
// 类型定义
// ============================================================

/** 用户自定义工具扩展 */
export interface ToolExtension {
	name: string
	description: string
	inputSchema: {
		type: 'object'
		properties: Record<string, unknown>
	}
	execute: (params: Record<string, unknown>) => Promise<{ content: string }>
}

/** 权限配置选项 */
export interface PermissionConfig {
	/** 是否绕过权限检查（用于 headless/自动化场景） */
	bypassPermissions?: boolean
	/** 可编程的权限决策委托（中间路径） */
	delegate?: PermissionDelegate
}

/**
 * 桥接配置选项（向后兼容）
 *
 * @deprecated 使用 UnifiedConfig 替代。将在 V19 移除。
 */
export interface BridgeOptions {
	cwd: string
	systemPrompt?: string | (() => Promise<string>)
	/** Agent 身份声明（精确替换 CC 默认身份前缀） */
	identityOverride?: string
	tools?: ToolExtension[]
	signal?: AbortSignal
	/** 历史消息（会话恢复时传入）- 使用兼容的类型 */
	initialMessages?: Array<Record<string, unknown>>
	/** 权限配置 */
	permissions?: PermissionConfig
	/** Provider 配置（per-session 覆盖） */
	provider?: {
		type?: string
		config?: Record<string, unknown>
	}
	/** 单次 query 最大 LLM turn 数 */
	maxTurns?: number
	/** 单次 query 最大 USD 预算 */
	maxBudgetUsd?: number
	/** 回调：LLM 调用时传出完整 system prompt（供外部 tracing 使用） */
	onSystemPromptResolved?: (fullPrompt: string) => void
}

// ============================================================
// 运行时初始化
// ============================================================

/**
 * initializeRuntime — 初始化 Claude Code 运行时环境（per-workspace）
 *
 * - 注入 MACRO namespace（如果尚未定义，全局只需一次）
 * - 调用 enableConfigs() 允许配置读取（全局只需一次）
 * - 设置 bootstrap 单例（首次调用时）
 * - 标记指定 workspace 已初始化
 *
 * === 多 workspace 支持 ===
 * 使用 CCRuntime 的 per-workspace 初始化跟踪，支持多 workspace 并发。
 * 每个 workspace 第一次调用时初始化，后续调用跳过。
 *
 * @param runtime CCRuntime 实例（默认使用全局单例）
 * @param workspace 工作目录
 */
export function initializeRuntime(runtime?: CCRuntime, workspace?: string): void {
	const ccRuntime = runtime ?? getGlobalCCRuntime()

	// 全局初始化（只需一次）
	if (!ccRuntime.isInitialized()) {
		// 1. 注入 MACRO defines（编译时常量在非 build 环境下不存在）
		ccRuntime.injectMacroDefines()

		// 2. enableConfigs — 允许配置系统读取
		ccRuntime.enableConfigs()

		ccRuntime.markInitialized()
	}

	// Per-workspace 初始化
	if (workspace && !ccRuntime.isWorkspaceInitialized(workspace)) {
		// 3. 设置 bootstrap 单例（首次初始化该 workspace 时）
		ccRuntime.setupBootstrap({
			cwd: workspace,
			originalCwd: workspace,
			projectRoot: workspace,
		})

		ccRuntime.markWorkspaceInitialized(workspace)
	}
}

// ============================================================
// Provider 创建辅助函数
// ============================================================

/**
 * createProviderWithConfig — 根据配置创建 Provider 实例
 *
 * T6 新增：支持多租户场景，每个会话可以使用不同的 Provider 配置。
 * T7 新增：支持自定义 Provider 注入，优先使用注册的自定义 Provider。
 *
 * 实现说明：
 * - 优先使用传入的自定义 providerRegistry
 * - 如果没有提供配置，使用注册表中的默认 Provider
 * - 配置会被传递给 Provider 构造函数
 * - Provider 内部会使用配置中的 apiKey/baseURL（优先级高于环境变量）
 *
 * @param providerType Provider 类型（如 'anthropic', 'openai'）
 * @param config Provider 配置（apiKey, baseURL, model 等）
 * @param options 可选参数，包含自定义 ProviderRegistry
 * @returns ProviderAdapter 实例，如果类型不支持返回 undefined
 */
async function createProviderWithConfig(
	providerType: string,
	config?: Record<string, unknown>,
	options?: { providerRegistry?: Awaited<ReturnType<typeof getGlobalProviderRegistry>> },
): Promise<ProviderAdapter | undefined> {
	try {
		// T7: 优先使用传入的自定义 ProviderRegistry
		if (options?.providerRegistry?.has(providerType)) {
			LogUtil.debug(`使用自定义 Provider: ${providerType}`)
			return options.providerRegistry.get(providerType)
		}

		// 如果没有提供配置，使用全局注册表中的默认 Provider
		if (!config || Object.keys(config).length === 0) {
			const registry = await getGlobalProviderRegistry()
			return registry.get(providerType)
		}

		// fallback 到内置 Provider
		switch (providerType) {
			case 'anthropic': {
				const {AnthropicProvider} = await import('../provider/adapters/AnthropicProvider.js')
				return new AnthropicProvider(config)
			}
			case 'openai': {
				const {OpenAIProvider} = await import('../provider/adapters/OpenAIProvider.js')
				return new OpenAIProvider(config)
			}
			case 'gemini': {
				const {GeminiProvider} = await import('../provider/adapters/GeminiProvider.js')
				return new GeminiProvider(config)
			}
			case 'grok': {
				const {GrokProvider} = await import('../provider/adapters/GrokProvider.js')
				return new GrokProvider(config)
			}
			case 'bedrock': {
				const {BedrockProvider} = await import('../provider/adapters/BedrockProvider.js')
				return new BedrockProvider(config)
			}
			case 'vertex': {
				const {VertexProvider} = await import('../provider/adapters/VertexProvider.js')
				return new VertexProvider(config)
			}
			case 'foundry': {
				const {FoundryProvider} = await import('../provider/adapters/FoundryProvider.js')
				return new FoundryProvider(config)
			}
			default:
				LogUtil.warn(`Unknown provider type: ${providerType}`)
				return undefined
		}
	} catch (error) {
		LogUtil.warn(`Failed to create provider '${providerType}':`, {detail: (error as Error).message})
		return undefined
	}
}

// ============================================================
// QueryEngineConfig 构造
// ============================================================

/**
 * buildQueryEngineConfig — 从统一配置构造 QueryEngineConfig
 *
 * V18 优化：使用 UnifiedConfig 替代 BridgeOptions，消除 as any 类型断言。
 *
 * @param config 统一配置
 * @param runtime CCRuntime 实例（默认使用全局单例）
 * @returns QueryEngineConfig（类型安全，无 as any）
 */
export async function buildQueryEngineConfig(config: UnifiedConfig, runtime?: CCRuntime): Promise<QueryEngineConfig> {
	const ccRuntime = runtime ?? getGlobalCCRuntime()
	const {cwd, systemPrompt, toolExtensions, provider} = config

	// 构造 CoreAppState（SDK/headless 模式，零 UI 依赖）
	let appState: CoreAppState & Record<string, unknown> = createDefaultCoreAppState() as CoreAppState & Record<string, unknown>

	// 类型安全的 AppState 转换
	// CoreAppState 是 QueryEngine 内部使用的最小字段集，运行时兼容
	const getAppState = (): CoreAppState & Record<string, unknown> => appState
	const setAppState = (fn: (prev: CoreAppState & Record<string, unknown>) => CoreAppState & Record<string, unknown>): void => {
		appState = fn(appState)
	}

	// 构造工具列表：内置工具 + 用户扩展工具
	const baseTools = ccRuntime.getAllBaseTools()
	const extensionTools = (toolExtensions ?? []).map(adaptToolExtension)
	const allTools: Tools = [...baseTools, ...extensionTools]

	// canUseTool 实现：根据权限配置决定是否使用 CC 原始权限检查
	const delegate = config.permissions?.delegate
	let canUseTool: CanUseToolFn
	if (config.permissions?.bypassPermissions || config.allowDangerouslySkipPermissions) {
		// bypass 模式：允许所有工具
		canUseTool = async () => ({behavior: 'allow' as const})
	} else if (delegate) {
		// delegate 模式：使用自定义权限策略
		canUseTool = async (
			tool: Tool,
			input: Record<string, unknown>,
			toolUseContext: ToolUseContext,
			assistantMessage: AssistantMessage,
			toolUseID: string,
		) => {
			const decision = await delegate.onToolAccess(
				(tool as { name?: string }).name ?? 'unknown',
				input as Record<string, unknown>,
			)
			if (decision === 'allow') return {behavior: 'allow' as const}
			if (decision === 'deny') {
				return {
					behavior: 'deny' as const,
					message: `Permission denied by delegate for tool: ${(tool as { name?: string }).name ?? 'unknown'}`,
					decisionReason: {type: 'other' as const, reason: 'Denied by PermissionDelegate'},
				}
			}
			// 'ask' — 回退到 CC 原始权限检查
			return ccRuntime.hasPermissionsToUseTool(tool, input, toolUseContext, assistantMessage, toolUseID) as Promise<ReturnType<CanUseToolFn>>
		}
	} else {
		// 默认：使用 CC 原始权限检查
		canUseTool = async (
			tool: Tool,
			input: Record<string, unknown>,
			toolUseContext: ToolUseContext,
			assistantMessage: AssistantMessage,
			toolUseID: string,
		) => {
			return ccRuntime.hasPermissionsToUseTool(tool, input, toolUseContext, assistantMessage, toolUseID) as Promise<ReturnType<CanUseToolFn>>
		}
	}

	// 提示词分层设计：
	// - identityOverride: 精确替换 CC 身份前缀（"你是谁"）
	// - appendSystemPrompt: Agent 扩展内容（skills/knowledge/instructions），追加在 CC 核心能力之后
	const identityOverride = config.identityOverride
	const appendSystemPrompt = typeof systemPrompt === 'string' ? systemPrompt : undefined

	// 构造 readFileCache（通过 CCRuntime）
	const readFileCache = ccRuntime.createFileStateCache({maxEntries: 100, maxSizeBytes: 25 * 1024 * 1024})

	// 构造 AbortController
	const abortController = new AbortController()

	// 如果指定了 provider.type，创建 ProviderAdapter 包装的 callModel
	// T7 完成：集成 CircuitBreaker、executeWithRetry 和自定义 Provider 注入
	// T6 完成：支持从 provider.config 传入 API Key、BaseURL 等配置
	let customDeps: QueryDeps | undefined
	if (provider?.type) {
		// T7: 传入 providerRegistry 以支持自定义 Provider 注入
		const providerAdapter = await createProviderWithConfig(
			provider.type,
			provider.config,
			{providerRegistry: config.providerRegistry}
		)
		if (providerAdapter) {
			const originalDeps = productionDeps()

			// 获取 Provider 的 CircuitBreaker（通过 unknown 中间类型避免类型错误）
			// ProviderAdapter 实现类（如 BaseProvider）有 circuitBreaker 属性
			const baseProvider = providerAdapter as unknown as {
				circuitBreaker: {
					canExecute: () => boolean
					recordSuccess: () => void
					recordFailure: () => void
				}
			}

			customDeps = {
				...originalDeps,
				// 使用 CircuitBreaker 包装 callModel（async generator 匹配 queryModelWithStreaming 返回类型）
				callModel: async function* (params) {
					// 关键日志：LLM API 调用入口
					const msgTypes = (params as any).messages?.map((m: any) => m.type || m.role) ?? []
					const systemPromptArr = (params as any).systemPrompt as string[] | undefined
					const fullPrompt = Array.isArray(systemPromptArr)
						? systemPromptArr.join('\n\n')
						: String((params as any).systemPrompt ?? '')
					log.info('LLM API call', {
						provider: provider.type,
						messagesCount: msgTypes.length,
						messageRoles: msgTypes,
						systemPromptLength: fullPrompt.length,
						toolsCount: (params as any).tools?.length ?? 0,
					})

					// 通过回调传出完整 system prompt（供外部 tracing 使用）
					if (config.onSystemPromptResolved) {
						config.onSystemPromptResolved(fullPrompt)
					}

					// 检查熔断器状态
					if (!baseProvider.circuitBreaker.canExecute()) {
						throw new EngineError(
							EngineErrorCode.CIRCUIT_OPEN,
							`Provider "${provider.type}" circuit breaker is open, request rejected`
						)
					}

					try {
						// 委托原始 callModel（AsyncGenerator），透传所有流式事件
						yield* originalDeps.callModel(params)
						// 成功时记录
						baseProvider.circuitBreaker.recordSuccess()
					} catch (error) {
						// 检查是否是 AUTH_ERROR（401/403），认证错误不应触发熔断
						const errorObj = error as { status?: number; code?: string }
						const isAuthError =
							errorObj.status === 401 ||
							errorObj.status === 403 ||
							errorObj.code === 'AUTH_ERROR'

						if (!isAuthError) {
							// 非 AUTH_ERROR 才记录失败
							baseProvider.circuitBreaker.recordFailure()
						}
						throw error
					}
				},
			}
		}
	}

	// 类型安全的 QueryEngineConfig 构造
	// 注意：getAppState/setAppState 和 readFileCache 桥接到 CC 内部 AppState 类型，
	// 运行时兼容但编译期类型不同。
	//
	// 保留 as unknown as 的原因：
	// - QueryEngineConfig 期望的 AppState 类型与 engine/ 的 CoreAppState 不同
	// - CC 原始 AppState 包含 CLI 特定字段（如 messages、permissions）
	// - engine/ 的 CoreAppState 是精简的 SDK 版本，只包含核心状态
	// - 未来可通过统一 AppState 类型或创建适配器来消除此断言
	const queryEngineConfig = {
		cwd,
		tools: allTools,
		commands: [] as Command[],
		mcpClients: [],
		agents: [],
		canUseTool,
		getAppState: getAppState as unknown as QueryEngineConfig['getAppState'],
		setAppState: setAppState as unknown as QueryEngineConfig['setAppState'],
		readFileCache: readFileCache as unknown as QueryEngineConfig['readFileCache'],
		// CC 核心能力完整保留（不传 customSystemPrompt）
		// Agent 内容通过 appendSystemPrompt 追加
		// CC 核心能力完整保留（不传 customSystemPrompt）
		// identityOverride 精确替换 CC 身份前缀
		// appendSystemPrompt 追加 Agent 扩展内容（skills/knowledge/instructions）
		...(identityOverride ? {identityOverride} : {}),
		appendSystemPrompt,
		verbose: config.verbose ?? false,
		abortController,
		includePartialMessages: true,
		isNonInteractiveSession: true,
		hasAppendSystemPrompt: !!(appendSystemPrompt || identityOverride),
		// Loop 安全护栏
		...(config.maxTurns ? {maxTurns: config.maxTurns} : {}),
		...(config.maxBudgetUsd ? {maxBudgetUsd: config.maxBudgetUsd} : {}),
		// Provider 配置透传
		...(provider?.config?.model ? {userSpecifiedModel: provider.config.model as string} : {}),
		// fallbackModel
		...(config.fallbackModel ? {fallbackModel: config.fallbackModel} : {}),
		// 注入 customDeps（Provider 运行时接入）
		...(customDeps ? {customDeps} : {}),
	}

	return queryEngineConfig
}

/**
 * buildQueryEngineConfigFromOptions — 从桥接选项构造 QueryEngineConfig（向后兼容）
 *
 * @deprecated 将在 V21 移除。SDK 路径使用 buildQueryEngineConfig(UnifiedConfig)。
 *
 * @param options 桥接选项
 * @param runtime CCRuntime 实例（默认使用全局单例）
 */
export async function buildQueryEngineConfigFromOptions(options: BridgeOptions, runtime?: CCRuntime): Promise<QueryEngineConfig> {
	// 转换 BridgeOptions 到 UnifiedConfig
	const unifiedConfig: UnifiedConfig = {
		cwd: options.cwd,
		systemPrompt: options.systemPrompt,
		identityOverride: options.identityOverride,
		toolExtensions: options.tools,
		permissions: options.permissions,
		provider: options.provider ? {
			type: options.provider.type as NonNullable<UnifiedConfig['provider']>['type'],
			config: options.provider.config,
		} : undefined,
		verbose: false,
		maxTurns: options.maxTurns,
		maxBudgetUsd: options.maxBudgetUsd,
		onSystemPromptResolved: options.onSystemPromptResolved,
	}

	const queryEngineConfig = await buildQueryEngineConfig(unifiedConfig, runtime)

	// BridgeOptions 特有的字段：initialMessages（会话恢复）
	// UnifiedConfig 不包含此字段，需要单独处理
	// 类型转换：BridgeOptions 使用 Record<string, unknown>[] 以保持向后兼容
	if (options.initialMessages) {
		return {...queryEngineConfig, initialMessages: options.initialMessages as Message[]}
	}

	return queryEngineConfig
}

// ============================================================
// 工具适配
// ============================================================

/**
 * adaptToolExtension — 将 ToolExtension 适配为 Claude Code Tool 类型
 *
 * V19 优化：定义 SDKTool 接口明确最小方法集，但保留 as unknown as Tool
 *
 * 保留 as unknown as 的原因：
 * - CC Tool 接口包含 20+ 个方法，SDK 扩展工具只需要实现核心子集
 * - 运行时 QueryEngine 会调用 Tool 的完整方法（如 checkPermissions、toAutoClassifierInput）
 * - 这些缺失方法在运行时通过 fallback 逻辑处理（如 checkPermissions 返回默认允许）
 * - 未来可通过创建 ToolAdapter 包装器来消除此断言，但当前阶段保留实现
 */
export function adaptToolExtension(ext: ToolExtension): Tool {
	// 构造 JSON Schema 供 API 层直接使用（跳过 zodToJsonSchema）
	const jsonSchema: ToolInputJSONSchema = {
		type: 'object' as const,
		properties: ext.inputSchema.properties,
	}

	const sdkTool: SDKTool = {
		name: ext.name,
		// Zod schema — 用 z.record 作为宽松 fallback，避免 zodToJsonSchema 崩溃
		inputSchema: z.record(z.string(), z.unknown()),
		// JSON Schema — API 层优先使用此字段，不走 zodToJsonSchema
		inputJSONSchema: jsonSchema,
		isEnabled: () => true,
		isReadOnly: () => false,
		isConcurrencySafe: () => true,
		userFacingName: () => ext.name,
		async prompt() {
			return ext.description
		},
		async description() {
			return ext.description
		},
		async call(input: Record<string, unknown>) {
			const result = await ext.execute(input)
			return {
				type: 'result' as const,
				resultForAssistant: result.content,
				data: result,
			}
		},
	}

	// 保留 as unknown as Tool：SDKTool 是 Tool 的子集，运行时兼容
	return sdkTool as unknown as Tool
}

// ============================================================
// 测试辅助：重置运行时状态
// ============================================================

/** 仅用于测试：重置 runtimeInitialized 标志 */
export function _resetRuntimeForTesting(runtime?: CCRuntime): void {
	const ccRuntime = runtime ?? getGlobalCCRuntime()
	if (ccRuntime.resetForTesting) {
		ccRuntime.resetForTesting()
	}
}
