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
export type {AgentEngineConfig, QueryOptions, EngineStats} from './AgentEngine.js'
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

// Session 存储（engine 只提供 zero-dep 默认；具体后端如 PG/Redis/SQLite 由 product 注入）
export type {ISessionStore} from './storage/ISessionStore.js'
export type {Session} from './Session.js'
export {InMemorySessionStore} from './storage/InMemorySessionStore.js'
export {FilesystemSessionStore} from './storage/FilesystemSessionStore.js'

// AgentRegistry（Stage 3.2 — substrate 协议）
// Stage B1.3 + B3 — getBuiltIns() 协议方法 + 4 baseline manifests
export type {AgentManifest, AgentRegistry} from './agent-registry/index.js'
export {
	InMemoryAgentRegistry,
	FilesystemAgentRegistry,
	BUILT_IN_AGENT_MANIFESTS,
	GENERAL_PURPOSE_AGENT_MANIFEST,
	EXPLORE_AGENT_MANIFEST,
	PLAN_AGENT_MANIFEST,
	VERIFICATION_AGENT_MANIFEST,
} from './agent-registry/index.js'

// Sandbox（Stage 3.3 — 规则级护栏，secure-by-default）
export type {
	SandboxAdapter,
	SandboxDeny,
	ExecRequest,
	ExecResult,
	ReadFileOptions,
	ReadFileResult,
	WriteFileOptions,
	WriteFileResult,
	FetchRequest,
	FetchResult,
	LocalSandboxConfig,
} from './sandbox/index.js'
export {NoOpSandbox, LocalSandbox} from './sandbox/index.js'

// Run + RunStore（Stage 3.4 — stateless 状态外化协议；Stage 4.3 — Checkpoint）
export type {Run, RunStatus, RunSnapshot, RunStore, Checkpoint} from './run/index.js'
export {
	InMemoryRunStore,
	FileRunStore,
	rebuildSnapshotFromEvents,
	rebuildCheckpointFromEvents,
} from './run/index.js'

// Stage B1.2 — resume 前 messages 清理流水线（cc 等价行为）
export {
	filterUnresolvedToolUses,
	filterOrphanedThinkingOnlyMessages,
	filterWhitespaceOnlyAssistantMessages,
	cleanupForResume,
} from './run/index.js'

// Stage B1.4 — TeammateChannel 协议（agent teams 多 agent 协作）
// Stage B1.5 — TeammateBackend 协议（spawn 后端接口）
export type {
	TeammateChannel,
	TeammateMessage,
	TeammateMessageInput,
	StructuredMessage,
	TeammateBackend,
	SpawnTeammateInput,
	SpawnTeammateResult,
	TeammateStatus,
	TeammateInfo,
} from './teammate/index.js'
export {
	InMemoryTeammateChannel,
	encodeStructuredMessage,
	decodeStructuredMessage,
} from './teammate/index.js'

// Audit hash chain（Stage 4.1 — 合规护城河）
export type {AuditEvent, AuditEventStore, VerifyResult} from './audit/index.js'
export {GENESIS_HASH, NoopAuditStore, FilesystemAuditStore, canonicalJson, computeHash} from './audit/index.js'

// Channel（Stage 4.2 — 多 agent 通讯协议预留）
export type {Channel} from './channel/index.js'
export {InMemoryChannel} from './channel/index.js'

// Local artifact store（Stage 4.4 — content-addressable filesystem 实现 ArtifactHook）
export {LocalArtifactStore} from './artifact/index.js'

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

// Provider 配置（v6.0 P0.2.C — 旧 provider 双轨删除后仅保留 Anthropic 配置类型）
export type {AnthropicProviderConfig} from './provider/index.js'

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

// CoreAppState 类型（v6.0 P0.4: state/CoreAppStateFactory 已删，仅保留类型）
export type {CoreAppState, EffortValue} from './types/CoreAppState.js'

// Analytics 接口契约（v6.0 P0.4.D：删除 NoOpAnalyticsSink/attachNoOpAnalytics 仪式代码，仅保留 type 契约 + NoOp 默认实现）
export {NoOpAnalytics, noOpAnalytics, type Analytics} from './analytics/index.js'

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

// Bridge 模块（ToolExtension / PermissionConfig 类型）
export type {ToolExtension, PermissionConfig} from './bridge/extensions.js'

// =============================================================================
// Agent Loop API（v1.0 16 batch — substrate 内部唯一主循环）
// =============================================================================

export {AgentLoop} from './agent-loop/loop/AgentLoop.js'
export type {AgentLoopParams} from './agent-loop/loop/AgentLoop.js'
export type {LoopEvent, LoopResult, GovernanceSnapshot, GovernanceEvent} from './agent-loop/loop/loopEvents.js'

export {createToolUseContext, allowAllCanUseTool} from './agent-loop/dispatcher/ToolUseContext.js'
export type {
	ToolUseContext,
	CanUseToolFn,
	CanUseToolResult,
	KernelProtocolBag,
	CreateToolUseContextOptions,
} from './agent-loop/dispatcher/ToolUseContext.js'
export {ToolDispatcher} from './agent-loop/dispatcher/ToolDispatcher.js'
export type {ToolUpdate, ToolResultBlock, ToolUseBlock} from './agent-loop/dispatcher/ToolDispatcher.js'

export type {
	StreamingProviderAdapter,
	StreamingQueryParams,
} from './agent-loop/provider/StreamingProviderAdapter.js'
export {AnthropicStreamingProvider} from './agent-loop/provider/AnthropicStreamingProvider.js'

export type {
	StopReason,
	UsageSnapshot,
	CompleteContentBlock,
	PartialAssistantMessage,
	ParsedSSEEvent,
} from './agent-loop/types.js'
export {EMPTY_USAGE} from './agent-loop/types.js'

// Message types
export type {
	Message,
	AssistantMessage,
	UserMessage,
	SystemMessage,
	AttachmentMessage,
	ProgressMessage,
	ContentItem,
	MessageContent,
	MessageType,
	TypedMessageContent,
} from './types/message.js'

// Tool 类型（让 builtin-tools 用统一定义）
export type {
	Tool,
	Tools,
	CoreTool,
	UITool,
	ToolResult,
	ToolProgress,
	ToolProgressData,
	ToolCallProgress,
	ToolInputJSONSchema,
} from './types/tool.js'

// ============================================================
// 不应导出的内部实现
// ============================================================
// SessionManager / Session / Bridge
// SessionContextStorage / TokenBudgetManager / TranscriptParser
// 以上为内部实现，不对外暴露

// =============================================================================
// Runtime Kernel Protocols (Phase A — see docs/strategy/neptune-engine-runtime-kernel-design.md)
//
// Skill / Todo / TaskQueue / ToolRegistry / Memory — per-session protocol
// surfaces that builtin tools and product hosts both program against.
// Each module ships a default in-memory implementation; product hosts can
// substitute persistent or distributed implementations of the same interfaces.
// =============================================================================

export type {
	RegisteredSkill,
	SkillManifest,
	SkillRegistry,
	SkillSource,
} from './skill/index.js'
export {
	parseSkillMarkdown,
	serializeSkillToMarkdown,
	validateSkillManifest,
	SkillFormatError,
	InMemorySkillRegistry,
} from './skill/index.js'

export type {
	TodoEvent,
	TodoItem,
	TodoState,
	TodoStatus,
} from './todo/index.js'
export {InMemoryTodoState} from './todo/index.js'

export type {
	AgentRef,
	Task,
	TaskEvent,
	TaskFilter,
	TaskInput,
	TaskOutput,
	TaskPatch,
	TaskQueue,
	TaskStatus,
} from './task-queue/index.js'
export {InMemoryTaskQueue} from './task-queue/index.js'

export type {
	ToolFilter,
	ToolRegistry as KernelToolRegistry,
	ToolSearchResult,
} from './tool-registry/index.js'
export {InMemoryToolRegistry} from './tool-registry/index.js'

export type {
	MemoryEntry,
	MemoryEntryInput,
	MemoryQuery,
	MemoryRef,
	MemorySource,
	MemoryStore,
} from './memory/index.js'
export {InMemoryMemoryStore} from './memory/index.js'

// Stage B1.1: AgentScopedMemoryStore（cc agentMemory + agentMemorySnapshot 等价协议）
export type {
	AgentMemoryScope,
	AgentScopedMemoryStore,
	SnapshotCheckResult,
	FilesystemAgentScopedMemoryStoreConfig,
} from './memory/index.js'
export {FilesystemAgentScopedMemoryStore} from './memory/index.js'
