/**
 * engine/config/UnifiedConfig.ts
 *
 * 统一配置类型
 *
 * 职责：
 * - 合并 AgentEngineConfig 和 EngineConfig 的字段
 * - 提供类型安全的配置转换
 * - 支持配置优先级规则
 * - 配置决策链可追踪（诊断日志）
 *
 * 设计原则：
 * - 类型安全：消除 as any 类型断言
 * - 配置归一化：统一不同来源的配置
 * - 向后兼容：支持现有配置类型
 * - 可诊断性：记录每个配置字段的决策来源
 *
 * @example
 * ```ts
 * import { normalizeConfig } from './engine/config/index.js'
 *
 * const unified = normalizeConfig(
 *   { systemPrompt: '...' },
 *   settingsJson
 * )
 * ```
 */

import type {AgentEngineConfig, ProviderConfig} from '../AgentEngine.js'
import type {EngineConfig} from './ConfigValidation.js'
import type {SettingsJson} from '../../utils/settings/types.js'
import type {ToolExtension} from '../bridge/OriginalQueryEngineBridge.js'
import type {PermissionConfig} from '../bridge/OriginalQueryEngineBridge.js'
import type {ProviderRegistry} from '../provider/ProviderRegistry.js'
import {ConfigDiagnostics, ConfigSummary, type ConfigSourceType} from './ConfigDiagnostics.js'

/**
 * Provider 配置项（从 AgentEngine.ts 导入）
 * 支持在引擎级别或会话级别配置不同的 Provider（如 Anthropic、OpenAI 等）
 * 使用 discriminated union 确保类型安全。
 */
export type {ProviderConfig}

/**
 * 统一配置类型
 *
 * 合并 AgentEngineConfig 和 EngineConfig 的所有字段，
 * 提供统一的配置访问接口。
 *
 * 字段来源：
 * - 从 AgentEngineConfig: systemPrompt, extensions, options, memoryRoot, provider, sessionStore
 * - 从 EngineConfig: cwd, sessionId, bare, permissionMode, model, tools, mcpConfig, agents, worktreeEnabled 等
 *
 * 配置优先级（从高到低）：
 * 1. CODE: 代码中直接设置的 AgentEngineConfig
 * 2. SETTINGS: settings.json 中的配置
 * 3. DEFAULT: 默认值
 */
export interface UnifiedConfig {
	// ============================================================
	// 基础配置（来自 EngineConfig）
	// ============================================================

	/** 当前工作目录 */
	cwd: string
	/** 会话 ID（可选，用于恢复会话） */
	sessionId?: string
	/** 是否启用 bare 模式（最小化模式） */
	bare?: boolean

	// ============================================================
	// 权限配置
	// ============================================================

	/** 权限模式 */
	permissionMode?: 'default' | 'auto' | 'always' | 'never' | 'plan'
	/** 是否允许跳过权限检查（危险操作） */
	allowDangerouslySkipPermissions?: boolean
	/** 是否启用 debug 模式 */
	debug?: boolean
	/** debug 输出到 stderr */
	debugToStderr?: boolean

	// ============================================================
	// 模型配置
	// ============================================================

	/** 用户指定的模型 */
	model?: string
	/** 备用模型 */
	fallbackModel?: string
	/** API beta 功能标志 */
	betas?: string[]

	// ============================================================
	// 工具配置
	// ============================================================

	/** 基础工具列表 */
	baseTools?: string[]
	/** 允许的工具列表（白名单） */
	allowedTools?: string[]
	/** 禁止的工具列表（黑名单） */
	disallowedTools?: string[]
	/** 自定义工具扩展（来自 AgentEngineConfig） */
	toolExtensions?: ToolExtension[]

	// ============================================================
	// MCP 配置
	// ============================================================

	/** MCP 服务器配置（来自 EngineConfig） */
	mcpConfig?: Array<{
		/** 服务器名称 */
		name: string
		/** 服务器类型 */
		type?: 'stdio' | 'sdk' | 'sse'
		/** 命令（stdio 类型） */
		command?: string
		/** 参数（stdio 类型） */
		args?: string[]
		/** 环境（stdio 类型） */
		env?: Record<string, string>
		/** URL（sse/nanolens 类型） */
		url?: string
		/** 作用域 */
		scope?: string
	}>

	// ============================================================
	// Agent 配置
	// ============================================================

	/** 主线程 agent 类型 */
	agent?: string
	/** Agent ID（用于 teammate 模式） */
	agentId?: string
	/** CLI agents JSON（用于 --agents 标志） */
	agentsJson?: string

	// ============================================================
	// 文件配置
	// ============================================================

	/** 额外的跟踪目录 */
	addDir?: string[]
	/** 启动时下载的文件 */
	fileSpecs?: string[]

	// ============================================================
	// 高级配置
	// ============================================================

	/** 系统提示（来自 AgentEngineConfig） */
	systemPrompt?: string | (() => Promise<string>)
	/** 输入提示 */
	inputPrompt?: string | AsyncIterable<string>
	/** 输出格式 */
	outputFormat?: 'text' | 'stream-json'
	/** 输入格式 */
	inputFormat?: 'text' | 'stream-json'
	/** 是否启用 verbose */
	verbose?: boolean
	/** 是否禁用斜杠命令 */
	disableSlashCommands?: boolean
	/** 是否初始化模式（仅初始化，不启动） */
	init?: boolean
	/** 是否仅初始化模式 */
	initOnly?: boolean
	/** 是否维护模式 */
	maintenance?: boolean

	// ============================================================
	// Worktree 配置
	// ============================================================

	/** 是否启用 worktree */
	worktreeEnabled?: boolean
	/** worktree 名称 */
	worktreeName?: string
	/** worktree PR 编号 */
	worktreePRNumber?: number
	/** 是否启用 tmux */
	tmuxEnabled?: boolean

	// ============================================================
	// Assistant/Kairos 配置
	// ============================================================

	/** 是否启用 assistant 模式 */
	assistant?: boolean
	/** 是否启用 brief 模式 */
	brief?: boolean
	/** 是否启用 proactive 模式 */
	proactive?: boolean

	// ============================================================
	// 任务模式配置
	// ============================================================

	/** 任务列表 ID（Ant-only） */
	taskListId?: string

	// ============================================================
	// AgentEngine 扩展配置
	// ============================================================

	/** 技能扩展（基于文件系统的动态技能加载） */
	skills?: Array<{
		/** 技能根目录 */
		root: string
		/** 技能名称（可选） */
		name?: string
	}>
	/** 权限配置（来自 AgentEngineConfig） */
	permissions?: PermissionConfig

	// ============================================================
	// 运行时选项
	// ============================================================

	/** 最大并发会话数 */
	maxConcurrentSessions?: number
	/** 工作区根目录 */
	workspaceRoot?: string
	/** 每个 session 最大消息数（默认 10000） */
	maxMessagesPerSession?: number

	// ============================================================
	// Provider 配置
	// ============================================================

	/** Provider 配置（来自 AgentEngineConfig） */
	provider?: ProviderConfig
	/** 自定义 Provider 注册表（来自 AgentEngineConfig） */
	providerRegistry?: ProviderRegistry

	// ============================================================
	// 存储配置
	// ============================================================

	/** 记忆存储根目录，用于用户级记忆隔离 */
	memoryRoot?: string
	/** Session 持久化存储（可选） */
	sessionStore?: unknown // ISessionStore，避免循环导入

	// ============================================================
	// Feature Flag 配置
	// ============================================================

	/** Feature flag 覆盖配置（用于 SDK 模式） */
	features?: Record<string, boolean | string>
}

/**
 * normalizeConfig — 归一化配置（带诊断日志）
 *
 * 合并 AgentEngineConfig 和 SettingsJson，生成统一的配置对象。
 * 配置优先级（从高到低）：
 * 1. engineConfig: 代码中直接设置的配置
 * 2. settings: settings.json 中的配置
 * 3. default: 默认值
 *
 * 诊断日志：
 * - debug 级别：记录每个配置字段的决策来源
 * - info 级别：打印配置摘要
 *
 * @param engineConfig - AgentEngine 配置
 * @param settings - SettingsJson（可选）
 * @returns 统一配置对象
 */
export function normalizeConfig(
	engineConfig: AgentEngineConfig,
	settings?: SettingsJson,
): UnifiedConfig {
	const summary = new ConfigSummary()

	// ===== 基础配置 =====
	const cwdDiag = new ConfigDiagnostics('cwd')
	const cwdValue = engineConfig.options?.workspaceRoot
	cwdDiag.record('agentConfig', cwdValue ?? process.cwd())
	cwdDiag.finalize()
	summary.add('cwd', cwdValue ?? process.cwd(), cwdValue ? 'agentConfig' : 'default')

	const sessionIdDiag = new ConfigDiagnostics('sessionId')
	sessionIdDiag.record('default', undefined)
	sessionIdDiag.finalize()

	const bareDiag = new ConfigDiagnostics('bare')
	bareDiag.record('default', false)
	bareDiag.finalize()
	summary.add('bare', 'false', 'default')

	// ===== 权限配置 =====
	const permissionModeDiag = new ConfigDiagnostics('permissionMode')
	const bypassPermissions = engineConfig.extensions?.permissions?.bypassPermissions
	const permissionModeValue = bypassPermissions ? 'never' : undefined
	permissionModeDiag.record('agentConfig', permissionModeValue ?? 'default')
	permissionModeDiag.finalize()
	if (permissionModeValue) {
		summary.add('permissionMode', permissionModeValue, 'agentConfig')
	}

	const allowDangerouslySkipPermissionsDiag = new ConfigDiagnostics('allowDangerouslySkipPermissions')
	allowDangerouslySkipPermissionsDiag.record('agentConfig', bypassPermissions)
	allowDangerouslySkipPermissionsDiag.finalize()
	if (bypassPermissions) {
		summary.add('allowDangerouslySkipPermissions', String(bypassPermissions), 'agentConfig')
	}

	const debugDiag = new ConfigDiagnostics('debug')
	debugDiag.record('default', false)
	debugDiag.finalize()

	// ===== 模型配置 =====
	const modelDiag = new ConfigDiagnostics('model')
	const modelValue = engineConfig.provider?.config?.model as string | undefined
	if (modelValue) {
		modelDiag.record('agentConfig', modelValue)
	} else {
		modelDiag.record('default', undefined)
	}
	modelDiag.finalize()
	if (modelValue) {
		summary.add('model', modelValue, 'agentConfig')
	}

	const fallbackModelDiag = new ConfigDiagnostics('fallbackModel')
	const fallbackModelValue = engineConfig.provider?.config?.fallbackModel as string | undefined
	if (fallbackModelValue) {
		fallbackModelDiag.record('agentConfig', fallbackModelValue)
	} else {
		fallbackModelDiag.record('default', undefined)
	}
	fallbackModelDiag.finalize()
	if (fallbackModelValue) {
		summary.add('fallbackModel', fallbackModelValue, 'agentConfig')
	}

	// ===== 工具配置 =====
	const toolExtensionsDiag = new ConfigDiagnostics('toolExtensions')
	const toolExtensionsCount = engineConfig.extensions?.tools?.length ?? 0
	toolExtensionsDiag.record('agentConfig', `${toolExtensionsCount} tools`)
	toolExtensionsDiag.finalize()
	if (toolExtensionsCount > 0) {
		summary.add('toolExtensions', `${toolExtensionsCount} tools`, 'agentConfig')
	}

	// ===== 系统提示 =====
	const systemPromptDiag = new ConfigDiagnostics('systemPrompt')
	const systemPromptValue = engineConfig.systemPrompt
	const systemPromptSummary = typeof systemPromptValue === 'string'
		? `"${systemPromptValue.slice(0, 50)}..."`
		: typeof systemPromptValue === 'function'
			? '<function>'
			: '<undefined>'
	systemPromptDiag.record('agentConfig', systemPromptSummary)
	systemPromptDiag.finalize()
	if (systemPromptValue) {
		summary.add('systemPrompt', systemPromptSummary, 'agentConfig')
	}

	// ===== 技能配置 =====
	const skillsDiag = new ConfigDiagnostics('skills')
	const skillsCount = engineConfig.extensions?.skills?.length ?? 0
	skillsDiag.record('agentConfig', `${skillsCount} skills`)
	skillsDiag.finalize()
	if (skillsCount > 0) {
		summary.add('skills', `${skillsCount} skills`, 'agentConfig')
	}

	// ===== 运行时选项 =====
	const maxConcurrentSessionsDiag = new ConfigDiagnostics('maxConcurrentSessions')
	const maxConcurrentSessionsValue = engineConfig.options?.maxConcurrentSessions
	if (maxConcurrentSessionsValue) {
		maxConcurrentSessionsDiag.record('agentConfig', maxConcurrentSessionsValue)
	} else {
		maxConcurrentSessionsDiag.record('default', undefined)
	}
	maxConcurrentSessionsDiag.finalize()
	if (maxConcurrentSessionsValue) {
		summary.add('maxConcurrentSessions', String(maxConcurrentSessionsValue), 'agentConfig')
	}

	const maxMessagesPerSessionDiag = new ConfigDiagnostics('maxMessagesPerSession')
	const maxMessagesPerSessionValue = engineConfig.options?.maxMessagesPerSession
	if (maxMessagesPerSessionValue) {
		maxMessagesPerSessionDiag.record('agentConfig', maxMessagesPerSessionValue)
	} else {
		maxMessagesPerSessionDiag.record('default', 10000)
	}
	maxMessagesPerSessionDiag.finalize()
	if (maxMessagesPerSessionValue) {
		summary.add('maxMessagesPerSession', String(maxMessagesPerSessionValue), 'agentConfig')
	}

	// ===== Provider 配置 =====
	const providerTypeDiag = new ConfigDiagnostics('provider.type')
	const providerTypeValue = engineConfig.provider?.type
	if (providerTypeValue) {
		providerTypeDiag.record('agentConfig', providerTypeValue)
	} else {
		providerTypeDiag.record('default', 'anthropic')
	}
	providerTypeDiag.finalize()
	if (providerTypeValue && providerTypeValue !== 'anthropic') {
		summary.add('provider.type', providerTypeValue, 'agentConfig')
	}

	// ===== 存储配置 =====
	const memoryRootDiag = new ConfigDiagnostics('memoryRoot')
	const memoryRootValue = engineConfig.memoryRoot
	if (memoryRootValue) {
		memoryRootDiag.record('agentConfig', memoryRootValue)
	} else {
		memoryRootDiag.record('default', undefined)
	}
	memoryRootDiag.finalize()
	if (memoryRootValue) {
		summary.add('memoryRoot', memoryRootValue, 'agentConfig')
	}

	// ===== Feature Flag 配置 =====
	const featuresDiag = new ConfigDiagnostics('features')
	const featuresValue = engineConfig.options?.features
	const featuresCount = featuresValue ? Object.keys(featuresValue).length : 0
	featuresDiag.record('agentConfig', `${featuresCount} features`)
	featuresDiag.finalize()
	if (featuresCount > 0) {
		summary.add('features', `${featuresCount} features`, 'agentConfig')
	}

	// ===== 构建统一配置对象 =====
	const unified: UnifiedConfig = {
		// 基础配置
		cwd: cwdDiag.getFinalValue() as string,
		sessionId: undefined, // 会话由 AgentEngine 创建时分配
		bare: false,

		// 权限配置
		permissionMode: permissionModeDiag.getFinalValue() as any,
		allowDangerouslySkipPermissions: allowDangerouslySkipPermissionsDiag.getFinalValue() as boolean | undefined,
		debug: false,

		// 模型配置
		model: modelDiag.getFinalValue() as string | undefined,
		fallbackModel: fallbackModelDiag.getFinalValue() as string | undefined,

		// 工具配置
		toolExtensions: engineConfig.extensions?.tools,

		// AgentEngine 扩展配置
		systemPrompt: engineConfig.systemPrompt,
		skills: engineConfig.extensions?.skills?.map((s) => ({
			root: s.name,
			name: s.name,
		})),
		permissions: engineConfig.extensions?.permissions,

		// 运行时选项
		maxConcurrentSessions: engineConfig.options?.maxConcurrentSessions,
		workspaceRoot: engineConfig.options?.workspaceRoot,
		maxMessagesPerSession: engineConfig.options?.maxMessagesPerSession,

		// Provider 配置
		provider: engineConfig.provider,
		providerRegistry: engineConfig.providerRegistry,

		// 存储配置
		memoryRoot: engineConfig.memoryRoot,
		sessionStore: engineConfig.sessionStore,

		// Feature Flag 配置
		features: engineConfig.options?.features as Record<string, boolean | string> | undefined,
	}

	// 合并 settings.json 配置（低优先级）
	if (settings) {
		// TODO: 根据 SettingsJson 类型合并配置
		// 当前阶段先保留结构，后续补充具体字段映射
	}

	// 打印配置摘要
	summary.print()

	return unified
}
