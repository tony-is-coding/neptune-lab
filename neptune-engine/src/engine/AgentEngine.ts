/**
 * AgentEngine — 统一引擎入口
 *
 * AgentEngine 是 Claude Code Framework 的核心类，提供完整的 AI Agent 能力：
 * - Session 管理：创建、暂停、恢复、销毁会话
 * - 消息查询：流式查询（返回 AsyncGenerator）
 * - 事件系统：通过 EventBus 监听引擎事件
 * - 工具扩展：支持自定义工具和技能
 * - 权限控制：集成权限委托
 *
 * @example
 * ```typescript
 * const engine = AgentEngine.create({
 *   systemPrompt: '你是一个有帮助的 AI 助手',
 *   extensions: {
 *     tools: [myCustomTool],
 *     permissions: { bypassPermissions: true }
 *   }
 * })
 *
 * const sessionId = await engine.createSession()
 * for await (const message of engine.query(sessionId, '你好')) {
 *   console.log(message)
 * }
 * ```
 */
import {SessionManager} from './SessionManager'
import type {Session} from './Session'
import type {SessionInfo} from './types'
import {EngineError, EngineErrorCode, type EngineErrorCodeType} from './errors'
import {EventBus} from './events/EventBus'
import type {SessionStatus, SessionMetadata} from './types'
import type {ToolExtension} from './bridge/OriginalQueryEngineBridge'
import {
	initializeRuntime,
	buildQueryEngineConfig,
	buildQueryEngineConfigFromOptions,
	type BridgeOptions,
	type PermissionConfig,
} from './bridge/OriginalQueryEngineBridge'
import {loadSkillsToWorkspace, cleanupEngineSkills, type SkillExtension} from './skill/SkillLoader'
import {parseTranscript, transcriptToMessages} from './session/TranscriptParser'
import {
	createDefaultSessionContext,
	runInSessionContextAsync,
	type SessionContext,
} from './session/index.js'
import {clearTokenBudgetState} from './session/TokenBudgetManager.js'
import {getSessionStoragePath} from './session/SessionStoragePath'
import {existsSync, mkdirSync, readdirSync} from 'fs'
import {join, resolve} from 'path'
import type {CCRuntime} from './cc-runtime/CCRuntime.js'
import {getGlobalCCRuntime} from './cc-runtime/DefaultCCRuntime.js'
import type {FeatureOverride} from './compat/featureCompat.js'
import {isEnabledSync} from './compat/featureCompat.js'
import type {ISessionStore} from './storage/ISessionStore.js'
import type {ISessionContentStore} from './storage/ISessionContentStore.js'
import {InMemorySessionContentStore} from './storage/InMemorySessionContentStore.js'
import type {QueryEvent, SDKMessage} from './types/query-events.js'
import type {EngineEventMap} from './types/engine-events.js'
import type {ITracingProvider} from './observability/ITracingProvider.js'
import type {IMetricsProvider} from './observability/IMetricsProvider.js'
import {NoOpTracingProvider} from './observability/NoOpTracingProvider.js'
import {NoOpMetricsProvider} from './observability/NoOpMetricsProvider.js'
import {LogUtil} from './log/LogUtil.js'
import {asSessionId} from './types/ids.js'
import type {
	AnthropicProviderConfig,
	OpenAIProviderConfig,
	GeminiProviderConfig,
	GrokProviderConfig,
	BedrockProviderConfig,
	VertexProviderConfig,
	FoundryProviderConfig,
} from './provider/types/ProviderConfigs.js'
import type {ProviderRegistry} from './provider/ProviderRegistry.js'
import type {CircuitBreakerConfig} from './provider/CircuitBreaker.js'

// ============================================================
// 类型定义
// ============================================================

/** 有效的 Provider 类型列表 */
const VALID_PROVIDER_TYPES = ['anthropic', 'bedrock', 'vertex', 'foundry', 'openai', 'gemini', 'grok'] as const

/** Provider 类型联合 */
export type ProviderType = typeof VALID_PROVIDER_TYPES[number]

/** 配置校验错误 */
interface ConfigValidationError {
	path: string
	message: string
}

/** 配置校验结果 */
interface ConfigValidationResult {
	valid: boolean
	errors: ConfigValidationError[]
}

/**
 * 校验 AgentEngineConfig 配置
 *
 * @param config 引擎配置
 * @returns 校验结果
 */
function validateAgentEngineConfig(config: AgentEngineConfig): ConfigValidationResult {
	const errors: ConfigValidationError[] = []

	// 校验 systemPrompt
	if (config.systemPrompt !== undefined) {
		if (typeof config.systemPrompt !== 'string' && typeof config.systemPrompt !== 'function') {
			errors.push({
				path: 'systemPrompt',
				message: '必须是字符串或返回字符串的异步函数',
			})
		} else if (typeof config.systemPrompt === 'string' && config.systemPrompt.trim() === '') {
			errors.push({
				path: 'systemPrompt',
				message: '不能为空字符串',
			})
		}
	}

	// 校验 extensions.tools
	if (config.extensions?.tools !== undefined) {
		if (!Array.isArray(config.extensions.tools)) {
			errors.push({
				path: 'extensions.tools',
				message: '必须是数组',
			})
		}
	}

	// 校验 provider.type
	if (config.provider?.type !== undefined) {
		if (typeof config.provider.type !== 'string') {
			errors.push({
				path: 'provider.type',
				message: '必须是字符串',
			})
		} else if (!VALID_PROVIDER_TYPES.includes(config.provider.type as ProviderType)) {
			errors.push({
				path: 'provider.type',
				message: `必须是以下值之一: ${VALID_PROVIDER_TYPES.join(', ')}`,
			})
		}
	}

	return {
		valid: errors.length === 0,
		errors,
	}
}

/**
 * QueryEngine 接口抽象
 * 使用 any 是有意为之——QueryEngine 是 CC 原始代码，其 submitMessage
 * 签名依赖 Anthropic SDK 类型，强类型会导致耦合。框架只需调用它。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QueryEngineWrapper = { submitMessage: (...args: any[]) => AsyncGenerator<any, void, unknown> }

/**
 * Provider 配置项 — discriminated union 类型
 *
 * 支持在引擎级别或会话级别配置不同的 Provider（如 Anthropic、OpenAI 等）。
 * 使用 discriminated union 确保类型安全：每个 Provider 类型都有对应的配置类型。
 *
 * @example
 * ```typescript
 * // Anthropic Provider 配置
 * const anthropicConfig: ProviderConfig = {
 *   type: 'anthropic',
 *   config: {
 *     apiKey: 'sk-ant-...',
 *     baseURL: 'https://api.anthropic.com',
 *     defaultModel: 'claude-sonnet-4-20250514'
 *   }
 * }
 *
 * // OpenAI Provider 配置
 * const openaiConfig: ProviderConfig = {
 *   type: 'openai',
 *   config: {
 *     apiKey: 'sk-openai-...',
 *     baseURL: 'https://api.openai.com/v1',
 *     defaultModel: 'gpt-4o'
 *   }
 * }
 * ```
 */
export type ProviderConfig =
	| { type: 'anthropic'; config?: Omit<AnthropicProviderConfig, 'type'> }
	| { type: 'openai'; config?: Omit<OpenAIProviderConfig, 'type'> }
	| { type: 'gemini'; config?: Omit<GeminiProviderConfig, 'type'> }
	| { type: 'grok'; config?: Omit<GrokProviderConfig, 'type'> }
	| { type: 'bedrock'; config?: Omit<BedrockProviderConfig, 'type'> }
	| { type: 'vertex'; config?: Omit<VertexProviderConfig, 'type'> }
	| { type: 'foundry'; config?: Omit<FoundryProviderConfig, 'type'> }

/**
 * AgentEngine 配置选项
 */
export interface AgentEngineConfig {
	/** 系统提示词，可以是字符串或返回字符串的异步函数 */
	systemPrompt?: string | (() => Promise<string>)
	/** Agent 身份覆盖：精确替换 CC 默认身份前缀（"你是谁"） */
	identityOverride?: string
	/** CLI 当前工作目录（仅 CLI 模式需要） */
	cwd?: string
	/** 扩展配置 */
	extensions?: {
		/** 自定义工具列表（使用 ToolExtension 类型） */
		tools?: ToolExtension[]
		/** 技能扩展（基于文件系统的动态技能加载） */
		skills?: SkillExtension[]
		/** 权限配置 */
		permissions?: PermissionConfig
	}
	/** 工具集配置（SDK 模式下按需加载工具） */
	toolsets?: ('core' | 'filesystem' | 'web' | 'git' | 'development')[]
	/** 运行时选项 */
	options?: {
		/** 最大并发会话数 */
		maxConcurrentSessions?: number
		/** 工作区根目录 */
		workspaceRoot?: string
		/** Feature flag 覆盖配置（用于 SDK 模式） */
		features?: FeatureOverride
		/** 是否启用 analytics（默认 false，SDK 模式下使用 NoOpAnalytics） */
		enableAnalytics?: boolean
		/** 每个 session 最大消息数（默认 10000），超过时截断最早的消息 */
		maxMessagesPerSession?: number
		/** 单次 query 最大 LLM turn 数（防止无限循环，默认无限制） */
		maxTurns?: number
		/** 单次 query 最大 USD 预算 */
		maxBudgetUsd?: number
	}
	/** 记忆存储根目录，用于用户级记忆隔离 */
	memoryRoot?: string
	/** Provider 配置（支持 per-session 覆盖） */
	provider?: ProviderConfig
	/** 自定义 Provider 注册表，优先于内置 Provider 查找 */
	providerRegistry?: ProviderRegistry
	/** CircuitBreaker 熔断器配置 */
	circuitBreaker?: {
		/** 连续失败阈值，默认 5 */
		failureThreshold?: number
		/** 熔断恢复超时（毫秒），默认 30000 */
		resetTimeoutMs?: number
		/** 半开状态最大调用数，默认 3 */
		halfOpenMaxCalls?: number
	}
	/** Session 持久化存储（可选） */
	sessionStore?: ISessionStore
	/** Session 内容存储（可选，默认使用 InMemorySessionContentStore） */
	sessionContentStore?: ISessionContentStore
	/** Tracing Provider（可选，默认使用 NoOpTracingProvider） */
	tracingProvider?: ITracingProvider
	/** Metrics Provider（可选，默认使用 NoOpMetricsProvider） */
	metricsProvider?: IMetricsProvider
}

/**
 * 查询选项
 */
export interface QueryOptions {
	/** 元数据（可用于追踪和审计） */
	metadata?: Record<string, unknown>
	/** 中断信号（用于取消查询） */
	signal?: AbortSignal
	/** 回调：LLM 调用时传出完整 system prompt（供外部 tracing 使用） */
	onSystemPromptResolved?: (fullPrompt: string) => void
}

/**
 * 引擎统计信息
 */
export interface EngineStats {
	/** 总会话数 */
	totalSessions: number
	/** 活跃会话数 */
	activeSessions: number
	/** 暂停会话数 */
	pausedSessions: number
}

// ============================================================
// AgentEngine 实现
// ============================================================

/**
 * AgentEngine 类
 *
 * @example
 * ```typescript
 * // 创建引擎实例
 * const engine = AgentEngine.create({
 *   systemPrompt: '你是一个有帮助的 AI 助手'
 * })
 *
 * // 创建会话
 * const sessionId = await engine.createSession()
 *
 * // 执行查询（query 返回 AsyncGenerator）
 * for await (const message of engine.query(sessionId, '你好')) {
 *   console.log(message)
 * }
 * ```
 */
export class AgentEngine {
	private sessionManager: SessionManager
	private eventBus: EventBus
	private destroyed = false
	private config: AgentEngineConfig
	/** per-session 缓存 QueryEngine 实例，保持多轮对话上下文 */
	private queryEngines = new Map<string, QueryEngineWrapper>()
	/** per-session 缓存历史消息（会话恢复时填充，QueryEngine 创建时消费） */
	private sessionMessages = new Map<string, SDKMessage[]>()
	/** per-session 系统提示词覆盖（优先于 engine 级 systemPrompt） */
	private sessionPrompts = new Map<string, string | (() => Promise<string>)>()
	/** per-session Provider 配置覆盖（优先于 engine 级 provider） */
	private sessionProviders = new Map<string, ProviderConfig>()
	/** per-session 缓存 SessionContext */
	private sessionContexts = new Map<string, SessionContext>()
	/** 外部注入的 system prompt 回调 */
	_onSystemPromptResolved?: (fullPrompt: string) => void
	/** per-session AbortController，用于取消活跃查询 */
	private activeAbortControllers = new Map<string, AbortController>()
	/** per-session 互斥锁，防止并发 query 导致状态混乱 */
	private activeQueries = new Map<string, boolean>()
	/** CC 运行时抽象 */
	private ccRuntime: CCRuntime
	/** Session 内容存储（用于暂停恢复上下文） */
	private sessionContentStore: ISessionContentStore
	/** Session 持久化存储（可选） */
	private sessionStore?: ISessionStore
	/** Tracing Provider */
	private tracingProvider: ITracingProvider
	/** Metrics Provider */
	private metricsProvider: IMetricsProvider

	private constructor(sessionManager: SessionManager, eventBus: EventBus, config: AgentEngineConfig, ccRuntime: CCRuntime) {
		this.sessionManager = sessionManager
		this.eventBus = eventBus
		this.config = config
		this.ccRuntime = ccRuntime
		this.sessionContentStore = config.sessionContentStore ?? new InMemorySessionContentStore()
		this.sessionStore = config.sessionStore
		this.tracingProvider = config.tracingProvider ?? NoOpTracingProvider.getInstance()
		this.metricsProvider = config.metricsProvider ?? NoOpMetricsProvider.getInstance()

		// Register metrics event listeners
		this.setupMetricsListeners()
	}

	// ========== 静态工厂 ==========

	/**
	 * 创建 AgentEngine 实例
	 *
	 * @param config 引擎配置
	 * @param ccRuntime CCRuntime 实例（可选，默认使用全局单例）
	 */
	static create(config: AgentEngineConfig, ccRuntime?: CCRuntime): AgentEngine {
		// SDK 模式配置校验（不依赖 cwd）
		const validation = validateAgentEngineConfig(config)
		if (!validation.valid) {
			const errorMessages = validation.errors.map(e => `${e.path}: ${e.message}`).join('; ')
			throw new EngineError(
				EngineErrorCode.CONFIGURATION_ERROR,
				`Invalid AgentEngine config: ${errorMessages}`,
			)
		}

		// CLI 模式配置校验（如果 config 有 cwd 字段，使用 CLI 校验）
		if (config.cwd) {
			const {validateEngineConfig} = require('./config/ConfigValidation.js') as typeof import('./config/ConfigValidation.js')
			const cliValidation = validateEngineConfig(config as any)
			if (!cliValidation.valid) {
				throw new EngineError(
					EngineErrorCode.CONFIGURATION_ERROR,
					`Invalid engine config: ${cliValidation.errors.join(', ')}`,
				)
			}
		}

		// SDK 模式：初始化 NoOpAnalytics（避免 analytics 开销）
		// 只在没有 cwd（纯 SDK 模式）且没有显式启用 analytics 时使用
		if (!config.cwd && !config.options?.enableAnalytics) {
			const {attachNoOpAnalytics} = require('./analytics/index.js') as typeof import('./analytics/index.js')
			attachNoOpAnalytics()
		}

		const eventBus = new EventBus()
		const sessionManager = new SessionManager({
			maxConcurrentSessions: config.options?.maxConcurrentSessions,
			store: config.sessionStore,
		})
		const runtime = ccRuntime ?? getGlobalCCRuntime()
		return new AgentEngine(sessionManager, eventBus, config, runtime)
	}

	// ========== Session 管理 ==========

	async createSession(context?: {
		workspace?: string
		metadata?: Record<string, unknown>
		systemPrompt?: string | (() => Promise<string>)  // per-session 系统提示词
		sessionId?: string  // 外部指定 sessionId
		provider?: ProviderConfig  // per-session Provider 配置
	}): Promise<string> {
		this.assertNotDestroyed()
		const workspace = context?.workspace || `${process.cwd()}/.workspace/session-${Date.now()}`
		const sessionId = await this.sessionManager.createSession({
			workspace,
			metadata: context?.metadata ?? {},
			sessionId: context?.sessionId,
			systemPrompt: context?.systemPrompt,
			providerConfig: context?.provider,
		})

		// 创建 SessionContext
		const sessionCtx = createDefaultSessionContext(asSessionId(sessionId), workspace, workspace)
		this.sessionContexts.set(sessionId, sessionCtx)

		// 存储 per-session systemPrompt
		if (context?.systemPrompt !== undefined) {
			this.sessionPrompts.set(sessionId, context.systemPrompt)
		}

		// 存储 per-session Provider 配置
		if (context?.provider !== undefined) {
			this.sessionProviders.set(sessionId, context.provider)
		}

		// 将 SkillExtension 写入 workspace/.claude/skills/ 目录
		const skills = this.config.extensions?.skills
		if (skills?.length) {
			loadSkillsToWorkspace(skills, workspace)
		}

		// 生命周期事件：Session 创建成功
		this.eventBus.emit('session:created', {sessionId, workspace})

		// Metrics: session.created
		this.metricsProvider.counter('session.created').increment()

		return sessionId
	}

	async getSession(sessionId: string): Promise<SessionInfo | null> {
		const session = this.sessionManager.getSession(sessionId)
		if (!session) return null
		return this.toSessionInfo(session)
	}

	async listSessions(filter?: { status?: SessionStatus; workspace?: string }): Promise<SessionMetadata[]> {
		let sessions = this.sessionManager.listSessions()
		if (filter?.status) {
			sessions = sessions.filter(s => s.status === filter.status)
		}
		if (filter?.workspace) {
			sessions = sessions.filter(s => s.workspace === filter.workspace)
		}
		return sessions.map(s => ({
			id: s.sessionId,
			workspace: s.workspace,
			status: s.status,
			createdAt: s.createdAt,
			metadata: s.getMetadata() as Record<string, unknown>,
		}))
	}

	async pauseSession(sessionId: string): Promise<void> {
		this.assertNotDestroyed()

		// 保存消息历史以支持恢复时上下文连续
		const session = this.sessionManager.getSession(sessionId)
		if (session?.workspace) {
			const storagePath = getSessionStoragePath(session.workspace)
			if (storagePath && existsSync(storagePath)) {
				try {
					const transcript = parseTranscript(storagePath)
					const messages = transcriptToMessages(transcript)
					if (messages.length > 0) {
						this.sessionMessages.set(sessionId, messages as unknown as SDKMessage[])
					}
				} catch {
					// transcript 解析失败不阻塞 pause，只是恢复时上下文会丢失
				}
			}
		}

		// 清理 QueryEngine 资源（sessionMessages 已保存，恢复时可用）
		this.queryEngines.delete(sessionId)
		await this.sessionManager.pauseSession(sessionId)

		// 生命周期事件：Session 暂停成功
		if (session) {
			this.eventBus.emit('session:paused', {sessionId, workspace: session.workspace})
		}
	}

	async resumeSession(sessionId: string): Promise<void> {
		this.assertNotDestroyed()
		await this.sessionManager.resumeSession(sessionId)

		// 生命周期事件：Session 恢复成功
		const session = this.sessionManager.getSession(sessionId)
		if (session) {
			this.eventBus.emit('session:resumed', {sessionId, workspace: session.workspace})
		}
	}

	async destroySession(sessionId: string): Promise<void> {
		this.assertNotDestroyed()

		// 清理框架写入的 skill 文件
		const session = this.sessionManager.getSession(sessionId)
		const workspace = session?.workspace
		if (workspace) {
			cleanupEngineSkills(workspace)
		}

		this.queryEngines.delete(sessionId)
		this.sessionMessages.delete(sessionId)
		this.sessionPrompts.delete(sessionId)
		this.sessionProviders.delete(sessionId)
		this.sessionContexts.delete(sessionId)

		// 清理 TokenBudgetState
		clearTokenBudgetState(asSessionId(sessionId))

		await this.sessionManager.destroySession(sessionId)

		// 生命周期事件：Session 销毁成功
		if (workspace) {
			this.eventBus.emit('session:destroyed', {sessionId, workspace})
		}

		// Metrics: session.destroyed
		this.metricsProvider.counter('session.destroyed').increment()
	}

	// ========== 会话恢复 ==========

	/**
	 * 截断消息列表以符合最大消息数限制
	 *
	 * @param messages 原始消息列表
	 * @param sessionId 会话 ID（用于日志）
	 * @returns 截断后的消息列表
	 */
	private truncateMessagesIfNeeded(messages: SDKMessage[], sessionId: string): SDKMessage[] {
		// 处理负数或零限制：视为无限制
		const configuredMax = this.config.options?.maxMessagesPerSession ?? 10000
		const maxMessages = Math.max(0, configuredMax)

		if (maxMessages === 0 || messages.length <= maxMessages) {
			return messages
		}

		const truncatedCount = messages.length - maxMessages
		LogUtil.warn('Session 消息数超过限制，已截断最早的消息', {
			sessionId,
			originalCount: messages.length,
			truncatedCount,
			remainingCount: maxMessages,
			maxMessages,
		})

		// 截断最早的消息，保留最新的
		return messages.slice(truncatedCount)
	}

	/**
	 * 从 workspace 中的 transcript.jsonl 恢复旧会话
	 * 流程：定位 JSONL → 解析 → 创建 session → 返回 sessionId
	 * workspace 不存在或无 transcript 文件时返回 null
	 */
	async loadSession(options: { workspace: string }): Promise<string | null> {
		this.assertNotDestroyed()

		const {workspace} = options

		// 查找 Claude Code 存储的 JSONL 文件
		// Claude Code 将 transcript 存储在 ~/.claude/projects/{sanitized-workspace}/ 下
		const storagePath = getSessionStoragePath(workspace)
		let jsonlFile: string | null = null

		try {
			if (existsSync(storagePath)) {
				const files = readdirSync(storagePath) as string[]
				const jsonlFiles = files.filter((f: string) => f.endsWith('.jsonl'))
				if (jsonlFiles.length > 0) {
					// 取最新的 JSONL 文件
					jsonlFile = join(storagePath, jsonlFiles[jsonlFiles.length - 1])
				}
			}
		} catch (error) {
			// 存储路径不存在或无法读取
			LogUtil.debug('JSONL 文件查找失败', {workspace, error: String(error)})
		}

		// 也检查 workspace 本地的 transcript.jsonl（兼容旧逻辑）
		if (!jsonlFile) {
			const localTranscript = join(workspace, 'transcript.jsonl')
			if (existsSync(localTranscript)) {
				jsonlFile = localTranscript
			}
		}

		if (!jsonlFile) return null

		// 创建 session
		const sessionId = await this.createSession({workspace})

		// 使用 CCRuntime 的 loadTranscriptFromFile 解析 JSONL
		// 失败时 fallback 到简单解析器（兼容非标准 JSONL 格式）
		try {
			const logOption = await this.ccRuntime.loadTranscriptFromFile(jsonlFile)

			// logOption.messages 是 Claude Code 格式的 Message[]（完整对话链）
			if (logOption.messages && logOption.messages.length > 0) {
				const messages = this.truncateMessagesIfNeeded(
					logOption.messages as unknown as SDKMessage[],
					sessionId,
				)
				this.sessionMessages.set(sessionId, messages)
			}
		} catch (error) {
			// Claude Code 解析失败，fallback 到简单解析器
			LogUtil.debug('CCRuntime TranscriptParser 解析失败，尝试简单解析器', {jsonlFile, error: String(error)})
			try {
				const transcript = parseTranscript(jsonlFile)
				const messages = transcriptToMessages(transcript)
				if (messages.length > 0) {
					const truncatedMessages = this.truncateMessagesIfNeeded(
						messages as unknown as SDKMessage[],
						sessionId,
					)
					this.sessionMessages.set(sessionId, truncatedMessages)
				}
			} catch (fallbackError) {
				// 两种解析都失败，降级为空历史
				LogUtil.warn('所有 TranscriptParser 解析均失败，使用空历史', {jsonlFile, error: String(fallbackError)})
			}
		}

		return sessionId
	}

	// ========== 查询执行（桥接原始 QueryEngine） ==========

	async* query(sessionId: string, input: string, options?: QueryOptions): AsyncGenerator<QueryEvent> {
		this.assertNotDestroyed()

		// 0. 检查 session 是否已有活跃查询（互斥锁）
		if (this.activeQueries.get(sessionId)) {
			throw new EngineError(EngineErrorCode.SESSION_BUSY, `Session '${sessionId}' already has an active query`)
		}

		// 标记 session 为活跃状态
		this.activeQueries.set(sessionId, true)

		// Metrics: query.started
		this.metricsProvider.counter('query.started').increment()

		try {
			// 1. 验证 session 存在且可用
			const session = this.sessionManager.getSession(sessionId)
			if (!session) {
				throw new EngineError(EngineErrorCode.SESSION_NOT_FOUND, `Session '${sessionId}' not found`)
			}
			if (session.status === 'destroyed') {
				throw new EngineError(EngineErrorCode.SESSION_ALREADY_DESTROYED, `Session '${sessionId}' is destroyed`)
			}
			if (session.status === 'paused') {
				throw new EngineError(EngineErrorCode.SESSION_PAUSED, `Session '${sessionId}' is paused`)
			}

			// 2. 获取或创建 SessionContext
			let sessionCtx = this.sessionContexts.get(sessionId)
			if (!sessionCtx) {
				sessionCtx = createDefaultSessionContext(asSessionId(sessionId), session.workspace, session.workspace)
				this.sessionContexts.set(sessionId, sessionCtx)
			}

			// 恢复 memoryPath（如果之前通过 setMemoryPath 设置过）
			const memoryPath = session.getMetadata('memoryPath') as string | undefined
			if (memoryPath) {
				sessionCtx.memoryPath = memoryPath
			}

			// 3. 初始化运行时（per-workspace，支持多 workspace 并发）
			initializeRuntime(this.ccRuntime, session.workspace)

			// 4. 获取或创建 per-session QueryEngine（保持多轮对话上下文）
			let qe = this.queryEngines.get(sessionId)
			if (!qe) {
				// 从缓存中取出历史消息（会话恢复场景），取后删除避免重复
				const initialMessages = this.sessionMessages.get(sessionId)
				if (initialMessages) {
					this.sessionMessages.delete(sessionId)
				}

				// 优先使用 per-session systemPrompt，fallback 到 engine 级
				const effectiveSystemPrompt = this.sessionPrompts.get(sessionId) ?? this.config.systemPrompt

				// 优先使用 per-session provider，fallback 到 engine 级
				const effectiveProvider = this.sessionProviders.get(sessionId) ?? this.config.provider

				const bridgeOptions: BridgeOptions = {
					cwd: session.workspace,
					systemPrompt: effectiveSystemPrompt,
					identityOverride: this.config.identityOverride,
					tools: this.config.extensions?.tools as ToolExtension[] | undefined,
					signal: options?.signal,
					initialMessages,
					permissions: this.config.extensions?.permissions,
					provider: effectiveProvider,
					maxTurns: this.config.options?.maxTurns,
					maxBudgetUsd: this.config.options?.maxBudgetUsd,
					onSystemPromptResolved: options?.onSystemPromptResolved ?? this._onSystemPromptResolved,
				}
				const queryEngineConfig = await buildQueryEngineConfigFromOptions(bridgeOptions, this.ccRuntime)
				const queryEngine = this.ccRuntime.createQueryEngine(queryEngineConfig)
				this.queryEngines.set(sessionId, queryEngine)
				qe = queryEngine
			}

			// qe 已确保非 undefined（上方逻辑要么从 Map 取，要么创建新的）
			const engine = qe!

			// 5. 创建 AbortController 用于取消查询
			const abortController = new AbortController()
			this.activeAbortControllers.set(sessionId, abortController)

			// 组合外部 signal 和内部 abortController
			const combinedSignal = options?.signal
				? AbortSignal.any([options.signal, abortController.signal])
				: abortController.signal

			// 6. 在正确的 cwd 上下文中执行查询（多 workspace 支持）
			const eventBus = this.eventBus
			const ccRuntime = this.ccRuntime
			const workspace = session.workspace
			const engineInstance = this

			// 使用 runWithCwd 确保所有 getCwd/pwd() 调用返回正确的 workspace 路径
			// 注意：runWithCwd 的返回值需要通过 yield* 传播
			let sawErrorEvent = false
			yield* ccRuntime.runWithCwd(workspace, () =>
				runInSessionContextAsync(sessionCtx, async function* () {
					try {
						for await (const message of engine.submitMessage(input)) {
							// 检查是否被取消
							if (combinedSignal.aborted) {
								throw new EngineError(EngineErrorCode.EXECUTION_ERROR, 'Query was aborted')
							}

							// 在 yield 之前将消息发送到 EventBus
							try {
								const messageType = (message as { type: string }).type || 'message'
								eventBus.emit(messageType, message, sessionId)
							} catch (emitError) {
								// emit 异常不影响 yield，确保消息流继续
								LogUtil.debug('EventBus emit 异常', {sessionId, error: String(emitError)})
							}
							const messageType = (message as { type?: string }).type
							if (messageType === 'error' || messageType === 'assistant_error') {
								sawErrorEvent = true
							}
							yield message
						}
					} catch (error: any) {
						if (error instanceof EngineError) throw error
						// 使用错误分类器确定错误类型
						const errorCode = engineInstance.classifyQueryError(error)
						throw new EngineError(
							errorCode,
							`Query execution failed: ${error.message}`,
							{cause: error},
						)
					}
				}),
			)
			if (sawErrorEvent) {
				// query 通过事件流报告失败：补记 query.failed 计数
				this.metricsProvider.counter('query.failed').increment()
			}
		} catch (error) {
			this.metricsProvider.counter('query.failed').increment()
			throw error
		} finally {
			const ctx = this.sessionContexts.get(sessionId)
			if (ctx && Object.keys(ctx.modelUsage).length > 0) {
				try {
					this.eventBus.emit('query:complete', {
						sessionId,
						modelUsage: ctx.modelUsage,
					}, sessionId)
				} catch {
				}
			}
			// 清理 AbortController
			this.activeAbortControllers.delete(sessionId)
			// 释放 session 互斥锁
			this.activeQueries.delete(sessionId)
		}
	}

	// ========== 事件监听（委托 EventBus） ==========

	/**
	 * 监听引擎事件
	 * @param type 事件类型
	 * @param handler 事件处理器
	 * @param ttlMs 可选的 TTL 自动取消时间（毫秒）
	 * @param options 可选的订阅选项（如 sessionId）
	 * @returns 取消订阅的函数
	 */
	on<K extends keyof EngineEventMap>(
		type: K,
		handler: (payload: EngineEventMap[K]) => void,
		ttlMs?: number,
		options?: { sessionId?: string }
	): () => void {
		// 类型断言：EventBus 接受 (payload: unknown) => void
		return this.eventBus.on(type, handler as (payload: unknown) => void, ttlMs, options)
	}

	/**
	 * 取消监听引擎事件
	 * @param type 事件类型
	 * @param handler 事件处理器
	 */
	off<K extends keyof EngineEventMap>(type: K, handler: (payload: EngineEventMap[K]) => void): void {
		this.eventBus.unsubscribe(type, handler as (payload: unknown) => void)
	}

	/**
	 * 监听一次引擎事件
	 * @param type 事件类型
	 * @param handler 事件处理器
	 * @returns 取消订阅的函数
	 */
	once<K extends keyof EngineEventMap>(type: K, handler: (payload: EngineEventMap[K]) => void): () => void {
		const wrapper = (payload: unknown) => {
			this.eventBus.unsubscribe(type, wrapper)
			handler(payload as EngineEventMap[K])
		}
		this.eventBus.subscribe(type, wrapper)
		return () => this.eventBus.unsubscribe(type, wrapper)
	}

	// ========== 记忆路径管理 ==========

	/**
	 * 设置用户级记忆路径，通过 SessionContext 实现隔离
	 * @param sessionId 会话 ID
	 * @param userId 用户标识，用于构建隔离目录
	 */
	setMemoryPath(sessionId: string, userId: string): string {
		const memoryRoot = this.config.memoryRoot
		if (!memoryRoot) {
			throw new EngineError(
				EngineErrorCode.EXECUTION_ERROR,
				'memoryRoot is not configured. Set memoryRoot in AgentEngineConfig.options to enable memory paths'
			)
		}
		const memoryPath = resolve(join(memoryRoot, userId, 'memory'))
		mkdirSync(memoryPath, {recursive: true})

		// 存储在 session 的 metadata 中，以便在 query 时恢复到 SessionContext
		const session = this.sessionManager.getSession(sessionId)
		if (session) {
			session.setMetadata('memoryPath', memoryPath)
		}

		return memoryPath
	}

	/**
	 * 获取当前记忆路径（从 SessionContext 读取）
	 * 注意：此方法必须在 SessionContext 上下文中调用（即在 query() 执行期间）
	 */
	getMemoryPath(): string | undefined {
		return this.ccRuntime.getMemoryPath()
	}

	// ========== 生命周期 ==========

	getStats(): EngineStats {
		const sessions = this.sessionManager.listSessions()
		return {
			totalSessions: sessions.length,
			activeSessions: sessions.filter(s => s.status === 'active').length,
			pausedSessions: sessions.filter(s => s.status === 'paused').length,
		}
	}

	getEventBus(): EventBus {
		return this.eventBus
	}

	/** 仅用于测试：获取 session 缓存的历史消息 */
	_getSessionMessages(sessionId: string): SDKMessage[] | undefined {
		return this.sessionMessages.get(sessionId)
	}

	/** 仅用于测试：获取 session 级 systemPrompt */
	_getSessionPrompt(sessionId: string): string | (() => Promise<string>) | undefined {
		return this.sessionPrompts.get(sessionId)
	}

	async destroy(): Promise<void> {
		if (this.destroyed) return

		// 取消所有活跃查询的 AbortController
		for (const [sessionId, controller] of this.activeAbortControllers) {
			controller.abort()
		}
		this.activeAbortControllers.clear()

		this.destroyed = true

		// 生命周期事件：Engine 停止（在设置 destroyed 标志后发送）
		this.eventBus.emit('engine:stopped', {})

		this.queryEngines.clear()
		this.sessionMessages.clear()
		this.sessionPrompts.clear()
		this.sessionProviders.clear()
		this.sessionContexts.clear()

		// 清理 SessionManager 和 SessionStore
		this.sessionManager.dispose()
		if (this.sessionStore) {
			await this.sessionStore.dispose()
		}

		// 最后清理 EventBus
		this.eventBus.clear()
	}

	/**
	 * 优雅关机：注册 SIGINT/SIGTERM 信号处理器
	 *
	 * 当收到信号时：
	 * 1. 触发 'engine:shutdown' 事件
	 * 2. 调用 destroy() 清理资源
	 * 3. 退出进程（可选）
	 *
	 * @param options 选项
	 * @param options.exit 是否在清理后退出进程（默认 false）
	 * @param options.exitCode 退出码（默认 0）
	 * @returns 清理函数，用于手动取消注册
	 */
	gracefulShutdown(options?: { exit?: boolean; exitCode?: number }): () => void {
		const exit = options?.exit ?? false
		const exitCode = options?.exitCode ?? 0
		let cleanupRegistered = false

		const handler = async () => {
			// 触发关机事件
			this.eventBus.emit('engine:shutdown', {reason: 'signal'})

			// 清理资源
			await this.destroy()

			// 退出进程
			if (exit) {
				process.exit(exitCode)
			}
		}

		// 注册信号处理器
		const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM']
		signals.forEach((signal) => {
			process.on(signal, handler)
			cleanupRegistered = true
		})

		// 返回清理函数
		return () => {
			if (cleanupRegistered) {
				signals.forEach((signal) => {
					process.off(signal, handler)
				})
				cleanupRegistered = false
			}
		}
	}

	// ========== 内部方法 ==========

	/**
	 * 注册 metrics 事件监听器（tool_use / tool_result）
	 */
	private setupMetricsListeners(): void {
		this.eventBus.on('tool_use', (payload: unknown) => {
			const p = payload as { toolName?: string }
			this.metricsProvider.counter('tool.execution').increment()
			if (p?.toolName) {
				this.metricsProvider.counter(`tool.execution.${p.toolName}`).increment()
			}
		})
		this.eventBus.on('tool_result', (payload: unknown) => {
			const p = payload as { toolName?: string }
			this.metricsProvider.counter('tool.completed').increment()
			if (p?.toolName) {
				this.metricsProvider.counter(`tool.completed.${p.toolName}`).increment()
			}
		})
	}

	private assertNotDestroyed(): void {
		if (this.destroyed) {
			throw new EngineError(EngineErrorCode.EXECUTION_ERROR, 'AgentEngine is destroyed')
		}
	}

	/**
	 * 将 Session 实体转换为 SessionInfo DTO
	 */
	private toSessionInfo(session: Session): SessionInfo {
		return {
			id: session.sessionId,
			sessionId: session.sessionId,
			workspace: session.workspace,
			status: session.status,
			createdAt: session.createdAt,
			metadata: session.getMetadata() as Record<string, unknown>,
			systemPrompt: session.getSystemPrompt(),
			providerConfig: session.getProviderConfig(),
		}
	}

	/**
	 * 分类查询执行错误
	 *
	 * 根据 Error 类型和属性映射到对应的 EngineErrorCode。
	 * 此方法复用 BaseProvider 的分类逻辑。
	 *
	 * @param error 错误对象
	 * @returns 错误码
	 */
	private classifyQueryError(error: unknown): EngineErrorCodeType {
		// 1. 优先检查是否为 EngineError（直接使用 error.code）
		if (error instanceof EngineError) {
			return error.code
		}

		// 2. 检查 HTTP 状态码（error.status 或 error.statusCode）
		const err = error as { status?: number; statusCode?: number; message?: string }
		const httpStatus = err.status ?? err.statusCode

		if (httpStatus === 401 || httpStatus === 403) {
			return EngineErrorCode.AUTH_ERROR
		}
		if (httpStatus === 429 || httpStatus === 529) {
			return EngineErrorCode.RATE_LIMIT
		}
		if (httpStatus === 404) {
			return EngineErrorCode.PROVIDER_NOT_FOUND
		}
		if (httpStatus === 503 || httpStatus === 502) {
			return EngineErrorCode.NETWORK_ERROR
		}

		// 3. Fallback 到 message 文本匹配
		const errorMessage = error instanceof Error ? error.message : String(error)

		// 网络连接错误
		if (
			errorMessage.toLowerCase().includes('timeout') ||
			errorMessage.toLowerCase().includes('econnrefused') ||
			errorMessage.toLowerCase().includes('enotfound') ||
			errorMessage.toLowerCase().includes('network') ||
			errorMessage.toLowerCase().includes('fetch')
		) {
			return EngineErrorCode.NETWORK_ERROR
		}

		// 认证错误
		if (
			errorMessage.toLowerCase().includes('unauthorized') ||
			errorMessage.toLowerCase().includes('401') ||
			errorMessage.toLowerCase().includes('403') ||
			errorMessage.toLowerCase().includes('forbidden') ||
			errorMessage.toLowerCase().includes('invalid api key')
		) {
			return EngineErrorCode.AUTH_ERROR
		}

		// 速率限制错误
		if (
			errorMessage.toLowerCase().includes('rate limit') ||
			errorMessage.toLowerCase().includes('429') ||
			errorMessage.toLowerCase().includes('529') ||
			errorMessage.toLowerCase().includes('too many requests')
		) {
			return EngineErrorCode.RATE_LIMIT
		}

		// 默认执行错误
		return EngineErrorCode.EXECUTION_ERROR
	}
}
