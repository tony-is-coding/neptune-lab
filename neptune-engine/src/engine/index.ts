/**
 * engine/ 公共 API 导出
 *
 * 分四层组织导出：
 * - 第一层：核心公共 API（高频使用，80+ 处外部引用）
 * - 第二层：AgentEngine 核心 API（SDK 用户）
 * - 第三层：扩展 API
 * - 第四层：SDK 便捷 API
 */

// ============================================================
// 第一层：核心公共 API（高频使用）
// ============================================================

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
} from './session/index.js'

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
} from './session/index.js'

// 日志系统
export {LogUtil} from './log/index.js'
export {MDC} from './log/index.js'
export {StandardLogFormatter} from './log/index.js'
export {JsonLogFormatter} from './log/index.js'
export {ConsoleLogProvider} from './log/index.js'
export {FileLogStore} from './log/index.js'
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
} from './log/index.js'

// Config 模块（统一配置系统）
export type {IConfigProvider, ConfigEntry} from './config/index.js'
export {ConfigSource} from './config/index.js'
export {NoOpConfigProvider, noOpConfigProvider} from './config/index.js'
export type {UnifiedConfig} from './config/index.js'
export {normalizeConfig} from './config/index.js'
export {ConfigDiagnostics, ConfigSummary} from './config/index.js'
export type {ConfigSourceType} from './config/index.js'

// ============================================================
// 第二层：AgentEngine 核心 API（SDK 用户）
// ============================================================

export {AgentEngine} from './AgentEngine.js'
export type {AgentEngineConfig, QueryOptions, EngineStats, ProviderConfig, ProviderType} from './AgentEngine.js'
export {createHeadlessCCRuntime} from './cc-runtime/DefaultCCRuntime.js'
export type {
	SessionStatus,
	SessionConfig,
	SessionManagerConfig,
	SessionMetadata,
	EventBusMessage,
	SessionContextSnapshot,
	EngineSnapshot,
} from './types.js'
export {SERIALIZATION_PROTOCOL_VERSION} from './types.js'
export {EngineError, EngineErrorCode} from './errors.js'
export type {EngineErrorCodeType} from './errors.js'
export type {EngineEventMap, EngineEventType} from './types/engine-events.js'

// ============================================================
// 第三层：扩展 API
// ============================================================

// 核心状态管理
export {EngineState} from './EngineState.js'
export type {EngineStateData, EngineStateEvent} from './EngineState.js'

// Session 存储
export type {ISessionStore} from './storage/ISessionStore.js'
export type {Session} from './Session.js'
export {InMemorySessionStore} from './storage/InMemorySessionStore.js'
export {SQLiteSessionStore} from './storage/SQLiteSessionStore.js'

// CCRuntime
export type {CCRuntime} from './cc-runtime/index.js'
export {
	DefaultCCRuntime,
	createDefaultCCRuntime,
	getGlobalCCRuntime,
} from './cc-runtime/index.js'
export {MockCCRuntime, createMockCCRuntime} from './cc-runtime/index.js'

// 事件系统
export {EventBus} from './events/EventBus.js'

// Skill 扩展
export type {SkillExtension} from './skill/SkillLoader.js'
export {loadSkillsToWorkspace, cleanupEngineSkills} from './skill/SkillLoader.js'

// Tool 适配器
export {
	toolToCoreTool,
	coreToolToTool,
	hasUIImplementation,
	filterToCoreTools,
} from './tools/ToolAdapter.js'

// Hook 核心（headless/SDK 模式）
export {createHookCore, buildBaseHookInput} from './hooks/index.js'
export type {HookContext, HookResult, HookExecutor} from './hooks/index.js'

// 权限系统（SDK 可编程权限决策）
export type {PermissionDecision} from './permissions/PermissionDecision.js'
export type {PermissionDelegate} from './permissions/PermissionDelegate.js'
export {ReadOnlyPermissionDelegate} from './permissions/ReadOnlyPermissionDelegate.js'
export {RBACPermissionDelegate} from './permissions/RBACPermissionDelegate.js'
export {AuditPermissionDelegate} from './permissions/AuditPermissionDelegate.js'
export type {RolePermissionMap, ToolPermissionRule} from './permissions/RBACPermissionDelegate.js'

// 通用存储后端
export type {IBackend} from './storage/IBackend.js'
export {InMemoryBackend} from './storage/InMemoryBackend.js'
export {FilesystemBackend} from './storage/FilesystemBackend.js'
export {CompositeBackend} from './storage/CompositeBackend.js'

// Provider 适配器（多 Provider 支持）
export type {ProviderAdapter, ProviderQueryParams, ProviderMessage} from './provider/index.js'
export {ProviderRegistry, getGlobalProviderRegistry} from './provider/index.js'
export type {AnthropicProviderConfig} from './provider/index.js'
export type {BedrockProviderConfig} from './provider/index.js'
export type {VertexProviderConfig} from './provider/index.js'
export type {FoundryProviderConfig} from './provider/index.js'
export type {OpenAIProviderConfig} from './provider/index.js'
export type {GeminiProviderConfig} from './provider/index.js'
export type {GrokProviderConfig} from './provider/index.js'

// ============================================================
// 第四层：SDK 便捷 API
// ============================================================

// Query 事件类型
export type {
	QueryEvent,
	AssistantTextEvent,
	ToolUseEvent,
	ToolResultEvent,
	SystemEvent,
	ErrorEvent,
	SDKMessage,
	QueryEventType,
	QueryEventMetadata,
} from './types/query-events.js'
export {
	isAssistantTextEvent,
	isToolUseEvent,
	isToolResultEvent,
	isSystemEvent,
	isErrorEvent,
} from './types/query-events.js'

// 便捷辅助方法
export {collectText, collectTextWithMeta} from './helpers/collectText.js'
export {waitForResult, waitForResultWithTimeout, waitForEventType} from './helpers/waitForResult.js'

// CoreAppState 类型
export type {CoreAppState, EffortValue} from './types/CoreAppState.js'
export {createDefaultCoreAppState} from './state/CoreAppStateFactory.js'

// Context 模块（上下文卸载机制）
export type {OffloadStrategy, OffloadResult} from './context/index.js'
export {DefaultOffloadStrategy} from './context/index.js'

// Compat 模块（非 Bun 环境兼容）
export {isEnabled, isEnabledSync, createFeatureChecker} from './compat/index.js'
export type {FeatureOverride} from './compat/index.js'

// Analytics 模块（SDK 模式零开销 analytics）
export {NoOpAnalyticsSink, noOpAnalyticsSink, attachNoOpAnalytics} from './analytics/index.js'

// Observability 模块（可观测性：Tracing + Metrics）
export {NoOpTracingProvider} from './observability/index.js'
export {NoOpMetricsProvider} from './observability/index.js'
export {InMemoryMetricsProvider} from './observability/index.js'
export type {
	Span,
	Counter,
	Gauge,
	Histogram,
	Timer,
	ITracingProvider,
	IMetricsProvider,
} from './observability/index.js'
export {SpanStatus} from './observability/index.js'

// Bridge 模块（ToolExtension 类型）
export type {ToolExtension, PermissionConfig} from './bridge/OriginalQueryEngineBridge.js'

// ============================================================
// 不应导出的内部实现
// ============================================================
// SessionManager / Session / Bridge
// SessionContextStorage / TokenBudgetManager / TranscriptParser
// 以上为内部实现，不对外暴露
