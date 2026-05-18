/**
 * Claude Code Framework - 公共导出层
 *
 * 本文件作为框架核心（claude-code/src/）的统一导出层，供上层产品引用
 *
 * 分层组织：
 * - 第一层：Engine SDK（已完善的分层导出）
 * - 第二层：Query 系统（CLI 核心依赖）
 * - 第三层：工具系统
 * - 第四层：状态管理
 * - 第五层：类型定义
 * - 第六层：辅助函数
 * - CLI 专用（第七层）
 */

// ============================================================
// 第一层：Engine SDK（完善的分层导出）
// ============================================================
// 注意：由于 engine/index.ts 中存在一些运行时问题（如 CCRuntime 的导出），
// 这里只导出确认可用的核心部分。如果需要完整 Engine SDK，可直接引用 './engine/index.js'

// Session 上下文访问器
export {
	getSessionId,
	getIsRemoteMode,
	getProjectRoot,
	getOriginalCwd,
	getCwd,
	getMemoryPath,
	getSessionContext,
	runInSessionContext,
	runInSessionContextAsync,
	updateSessionContext,
	isSessionPersistenceDisabled,
	getIsNonInteractiveSession,
	getIsInteractive,
	getCurrentSessionId,
	getCurrentCwd,
	createDefaultSessionContext,
	type SessionContext,
	type SessionCronTask,
} from './engine/session/index.js'

// Token Budget
export {
	getTokenBudgetState,
	initTokenBudgetState,
	getTurnOutputTokens,
	getCurrentTurnTokenBudget,
	snapshotOutputTokensForTurn,
	incrementBudgetContinuationCount,
	getBudgetContinuationCount,
	clearTokenBudgetState,
	tokenBudgetStates,
	type TokenBudgetState,
} from './engine/session/index.js'

// 日志系统
export {LogUtil} from './engine/log/index.js'
export {MDC} from './engine/log/index.js'
export {StandardLogFormatter} from './engine/log/index.js'
export {JsonLogFormatter} from './engine/log/index.js'
export {ConsoleLogProvider} from './engine/log/index.js'
export {FileLogStore} from './engine/log/index.js'
export type {
	LogLevel,
	EngineLogger,
	LogRecord,
	LogConfig,
	CallSite,
	LogFormatter,
	LogProvider,
	LogStore,
	MDCContext,
	FileLogStoreOptions,
} from './engine/log/index.js'

// AgentEngine 核心
export {AgentEngine} from './engine/AgentEngine.js'
export type {AgentEngineConfig, QueryOptions, EngineStats, ProviderConfig} from './engine/AgentEngine.js'
export type {
	SessionStatus,
	SessionConfig,
	SessionManagerConfig,
	SessionMetadata,
	EventBusMessage,
	SessionContextSnapshot,
	EngineSnapshot,
	SessionInfo,
} from './engine/types.js'

// 桥接层类型导出（ToolExtension, PermissionConfig）
export type {ToolExtension, PermissionConfig} from './engine/bridge/OriginalQueryEngineBridge.js'

// Skill 类型导出（SkillExtension）
export type {SkillExtension} from './engine/skill/SkillLoader.js'
export {SERIALIZATION_PROTOCOL_VERSION} from './engine/types.js'
export {EngineError, EngineErrorCode} from './engine/errors.js'
export type {EngineErrorCodeType} from './engine/errors.js'

// 引擎配置验证模块（从 initializeEngine 提取）
export {
	validateEngineConfig,
} from './engine/config/index.js'
export type {
	EngineConfig,
	McpServerConfig,
} from './engine/config/index.js'

// 核心状态管理
export {EngineState} from './engine/EngineState.js'
export type {EngineStateData, EngineStateEvent} from './engine/EngineState.js'

// Hook 系统（新增）
export {createHookCore, buildBaseHookInput} from './engine/hooks/index.js'
export type {HookExecutor, HookContext, HookResult} from './engine/hooks/index.js'

// Session 存储
export type {ISessionStore} from './engine/storage/ISessionStore.js'
export {InMemorySessionStore} from './engine/storage/InMemorySessionStore.js'
export {SQLiteSessionStore} from './engine/storage/SQLiteSessionStore.js'

// 通用存储后端（新增）
export type {IBackend} from './engine/storage/IBackend.js'
export {InMemoryBackend} from './engine/storage/InMemoryBackend.js'
export {FilesystemBackend} from './engine/storage/FilesystemBackend.js'
export {CompositeBackend} from './engine/storage/CompositeBackend.js'

// 事件系统
export {EventBus} from './engine/events/EventBus.js'

// CCRuntime（新增）
export {
	DefaultCCRuntime,
	createDefaultCCRuntime,
	getGlobalCCRuntime,
} from './engine/cc-runtime/index.js'
export type {CCRuntime} from './engine/cc-runtime/index.js'

// Tool 适配器（新增）
export {
	toolToCoreTool,
	coreToolToTool,
	hasUIImplementation,
	filterToCoreTools,
} from './engine/tools/ToolAdapter.js'

// 权限系统（新增）
export type {PermissionDelegate, PermissionDecision} from './engine/permissions/index.js'
export {ReadOnlyPermissionDelegate} from './engine/permissions/index.js'
export {RBACPermissionDelegate} from './engine/permissions/index.js'
export {AuditPermissionDelegate} from './engine/permissions/index.js'
export type {RolePermissionMap, ToolPermissionRule} from './engine/permissions/index.js'

// ============================================================
// 第二层：Query 系统（CLI 核心依赖）
// ============================================================
export {query} from './query.js'
export {QueryEngine} from './QueryEngine.js'

// ============================================================
// 第三层：工具系统
// ============================================================
export {getTools} from './tools.js'
export {findToolByName, toolMatchesName} from './Tool.js'
export type {Tool, ToolUseContext} from './Tool.js'

// ============================================================
// 第四层：状态管理
// ============================================================
export {createStore} from './state/store.js'
export {onChangeAppState} from './state/onChangeAppState.js'
export {getDefaultAppState} from './state/AppStateStore.js'
export type {AppState} from './state/AppState.js'

// ============================================================
// 第五层：类型定义
// ============================================================
export type {Command} from './types/command.js'
export type {ICommandProvider} from './types/commandProvider.js'

// ============================================================
// 第六层：辅助函数
// ============================================================
export {getSystemContext, getUserContext} from './context.js'

// Provider 系统（新增）
export {ProviderRegistry} from './engine/provider/index.js'
export type {ProviderAdapter, ProviderQueryParams, ProviderMessage} from './engine/provider/index.js'
export type {ProviderType} from './engine/AgentEngine.js'
export {AnthropicProvider} from './engine/provider/index.js'
export type {AnthropicProviderConfig} from './engine/provider/index.js'
export {OpenAIProvider} from './engine/provider/index.js'
export type {OpenAIProviderConfig} from './engine/provider/index.js'
export {GeminiProvider} from './engine/provider/index.js'
export type {GeminiProviderConfig} from './engine/provider/index.js'
export {GrokProvider} from './engine/provider/index.js'
export type {GrokProviderConfig} from './engine/provider/index.js'
export {BedrockProvider} from './engine/provider/index.js'
export type {BedrockProviderConfig} from './engine/provider/index.js'
export {VertexProvider} from './engine/provider/index.js'
export type {VertexProviderConfig} from './engine/provider/index.js'
export {FoundryProvider} from './engine/provider/index.js'
export type {FoundryProviderConfig} from './engine/provider/index.js'

// 辅助工具（新增）
export {waitForResult} from './engine/helpers/waitForResult.js'
export {collectText} from './engine/helpers/collectText.js'

// ============================================================
// 第七层：CLI 专用（CLI 宿主特有，SDK 不依赖）
// ============================================================

// 命令提供者（CLI 启动时注入）
export {setCommandProvider, getCommandProvider} from './commands.js'

// Bootstrap state（运行时状态）- 选择性导出 SDK 需要的核心 getter/setter
// 注意：Session 相关的 getter/setter 已由 engine/session/ 模块提供更好的封装
// 这里只导出 CLI 特有的状态管理函数（成本追踪、CWD 状态等）
export {
	// CWD 状态（不同于 engine/session 的 getCwd，这是 CLI 内部状态）
	getCwdState,
	setCwdState,
	// 成本追踪
	getTotalCostUSD,
	getTotalAPIDuration,
	getTotalDuration,
	getTotalToolDuration,
	resetCostState,
	getModelUsage,
	getUsageForModel,
	// Session 管理（CLI 特有）
	switchSession,
	getSessionProjectDir,
	onSessionSwitch,
	// 测试工具
	resetStateForTests,
} from './bootstrap/state.js'
