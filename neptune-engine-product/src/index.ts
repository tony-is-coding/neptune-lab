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
} from '@neptune/engine/session/index.js'

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
} from '@neptune/engine/session/index.js'

// 日志系统
export {LogUtil} from '@neptune/engine/log/index.js'
export {MDC} from '@neptune/engine/log/index.js'
export {StandardLogFormatter} from '@neptune/engine/log/index.js'
export {JsonLogFormatter} from '@neptune/engine/log/index.js'
export {ConsoleLogProvider} from '@neptune/engine/log/index.js'
export {FileLogStore} from '@neptune/engine/log/index.js'
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
} from '@neptune/engine/log/index.js'

// AgentEngine 核心
export {AgentEngine} from '@neptune/engine/AgentEngine.js'
export type {AgentEngineConfig, QueryOptions, EngineStats} from '@neptune/engine/AgentEngine.js'
export type {
	SessionStatus,
	SessionConfig,
	SessionManagerConfig,
	SessionMetadata,
	EventBusMessage,
	SessionContextSnapshot,
	EngineSnapshot,
	SessionInfo,
} from '@neptune/engine/types.js'

// 桥接层类型导出（ToolExtension, PermissionConfig）
export type {ToolExtension, PermissionConfig} from '@neptune/engine/bridge/extensions.js'

// Skill 类型导出（SkillExtension）
export type {SkillExtension} from '@neptune/engine/skill/SkillLoader.js'
export {SERIALIZATION_PROTOCOL_VERSION} from '@neptune/engine/types.js'
export {EngineError, EngineErrorCode} from '@neptune/engine/errors.js'
export type {EngineErrorCodeType} from '@neptune/engine/errors.js'

// 引擎配置验证模块（从 initializeEngine 提取）
export {
	validateEngineConfig,
} from '@neptune/engine/config/index.js'
export type {
	EngineConfig,
	McpServerConfig,
} from '@neptune/engine/config/index.js'

// 核心状态管理
export {EngineState} from '@neptune/engine/EngineState.js'
export type {EngineStateData, EngineStateEvent} from '@neptune/engine/EngineState.js'

// Hook 系统（新增）
export {createHookCore, buildBaseHookInput} from '@neptune/engine/hooks/index.js'
export type {HookExecutor, HookContext, HookResult} from '@neptune/engine/hooks/index.js'

// Session 存储
export type {ISessionStore} from '@neptune/engine/storage/ISessionStore.js'
export {InMemorySessionStore} from '@neptune/engine/storage/InMemorySessionStore.js'
export {FilesystemSessionStore} from '@neptune/engine/storage/FilesystemSessionStore.js'
// Specific backends live in product layer (Stage 3 decoupling)
export {SQLiteSessionStore} from './storage/SQLiteSessionStore.js'
export {PgSessionStore, type PgSessionStoreConfig} from './storage/PgSessionStore.js'
export {PgContentStore, type PgContentStoreConfig} from './storage/PgContentStore.js'
export {RedisMemoryStore, type RedisMemoryStoreConfig} from './storage/RedisMemoryStore.js'

// 通用存储后端（新增）
export type {IBackend} from '@neptune/engine/storage/IBackend.js'
export {InMemoryBackend} from '@neptune/engine/storage/InMemoryBackend.js'
export {FilesystemBackend} from '@neptune/engine/storage/FilesystemBackend.js'
export {CompositeBackend} from '@neptune/engine/storage/CompositeBackend.js'

// 事件系统
export {EventBus} from '@neptune/engine/events/EventBus.js'

// CCRuntime（新增）
export {
	DefaultCCRuntime,
	createDefaultCCRuntime,
	getGlobalCCRuntime,
} from '@neptune/engine/cc-runtime/index.js'
export type {CCRuntime} from '@neptune/engine/cc-runtime/index.js'

// Tool 适配器（新增）
export {
	toolToCoreTool,
	coreToolToTool,
	hasUIImplementation,
	filterToCoreTools,
} from '@neptune/engine/tools/ToolAdapter.js'

// 权限系统（新增）
export type {PermissionDelegate, PermissionDecision} from '@neptune/engine/permissions/index.js'
export {ReadOnlyPermissionDelegate} from '@neptune/engine/permissions/index.js'
export {RBACPermissionDelegate} from '@neptune/engine/permissions/index.js'
export {AuditPermissionDelegate} from '@neptune/engine/permissions/index.js'
export type {RolePermissionMap, ToolPermissionRule} from '@neptune/engine/permissions/index.js'

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

// Provider 配置（v6.0 P0.2.C — 旧 provider 双轨删除后仅保留 Anthropic 配置类型）
export type {AnthropicProviderConfig} from '@neptune/engine/provider/index.js'

// 辅助工具（新增）
export {waitForResult} from '@neptune/engine/helpers/waitForResult.js'
export {collectText} from '@neptune/engine/helpers/collectText.js'

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
