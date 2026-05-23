/**
 * ToolContext 类型定义 — CoreToolContext + UIToolContext 分离
 *
 * 将 ToolUseContext 拆分为核心上下文和 UI 上下文，
 * 支持 non-CLI 环境的工具执行。
 *
 * 关键决策：保持与 Tool.ts 中 ToolUseContext 的字段一致，确保向后兼容。
 *
 * 注意：此文件中的 SetToolJSXFn 使用 unknown 替代 ReactNode，
 * 以避免 engine/ 目录依赖 React。
 */
import type { SystemMessage, SystemLocalCommandMessage, Message } from './message.js';
import type { AppState } from '../state/AppStateStore.js';
import type { FileStateCache } from '../utils/fileStateCache.js';
import type { CanUseToolFn } from './permissions.js';
import type { Command } from '../commands.js';
import type { ThinkingConfig } from '../utils/thinking.js';
import type { MCPServerConnection, ServerResource } from '../services/mcp/types.js';
import type { AgentDefinitionsResult } from '@neptune/builtin-tools/tools/AgentTool/loadAgentsDir.js';
import type { QuerySource } from '../constants/querySource.js';
import type { Tools } from './toolTypes.js';
import type { ElicitRequestURLParams, ElicitResult } from '@modelcontextprotocol/sdk/types.js';
import type { FileHistoryState } from '../utils/fileHistory.js';
import type { AttributionState } from '../utils/commitAttribution.js';
import type { AgentId } from './ids.js';
import type { QueryChainTracking, SetToolJSXFn, CompactProgressEvent } from '../Tool.js';
import type { DenialTrackingState } from '../utils/permissions/denialTracking.js';
import type { ContentReplacementState } from '../utils/toolResultStorage.js';
import type { Notification } from './notification.js';
import type { SpinnerMode } from './spinner.js';
import type { SDKStatus } from '../entrypoints/agentSdkTypes.js';
import type { UUID } from 'crypto';
import type { PromptRequest, PromptResponse } from './hooks.js';
import type { LangfuseSpan } from '../services/langfuse/index.js';
import type { SystemPrompt } from '../utils/systemPromptType.js';
/**
 * CoreToolContext — 核心工具上下文
 *
 * 包含工具执行所需的核心上下文，无 UI 依赖。
 * 可在 non-CLI 环境使用。
 */
export interface CoreToolContext {
    options: {
        commands: Command[];
        debug: boolean;
        mainLoopModel: string;
        tools: Tools;
        verbose: boolean;
        thinkingConfig: ThinkingConfig;
        mcpClients: MCPServerConnection[];
        mcpResources: Record<string, ServerResource[]>;
        isNonInteractiveSession: boolean;
        agentDefinitions: AgentDefinitionsResult;
        maxBudgetUsd?: number;
        customSystemPrompt?: string;
        appendSystemPrompt?: string;
        querySource?: QuerySource;
        refreshTools?: () => Tools;
    };
    abortController: AbortController;
    readFileState: FileStateCache;
    getAppState(): AppState;
    setAppState(f: (prev: AppState) => AppState): void;
    setAppStateForTasks?: (f: (prev: AppState) => AppState) => void;
    handleElicitation?: (serverName: string, params: ElicitRequestURLParams, signal: AbortSignal) => Promise<ElicitResult>;
    messages: Message[];
    setInProgressToolUseIDs: (f: (prev: Set<string>) => Set<string>) => void;
    setResponseLength: (f: (prev: number) => number) => void;
    updateFileHistoryState: (updater: (prev: FileHistoryState) => FileHistoryState) => void;
    updateAttributionState: (updater: (prev: AttributionState) => AttributionState) => void;
    toolUseId?: string;
    agentId?: AgentId;
    agentType?: string;
    requireCanUseTool?: boolean;
    queryTracking?: QueryChainTracking;
    localDenialTracking?: DenialTrackingState;
    contentReplacementState?: ContentReplacementState;
}
/**
 * UIToolContext — UI 工具上下文
 *
 * 扩展 CoreToolContext，添加 UI 相关的回调和方法。
 * 仅 CLI 环境需要。
 */
export interface UIToolContext extends CoreToolContext {
    setToolJSX?: SetToolJSXFn;
    addNotification?: (notif: Notification | Record<string, unknown>) => void;
    appendSystemMessage?: (msg: Exclude<SystemMessage, SystemLocalCommandMessage>) => void;
    sendOSNotification?: (opts: {
        message: string;
        notificationType: string;
    }) => void;
    nestedMemoryAttachmentTriggers?: Set<string>;
    loadedNestedMemoryPaths?: Set<string>;
    dynamicSkillDirTriggers?: Set<string>;
    discoveredSkillNames?: Set<string>;
    userModified?: boolean;
    setHasInterruptibleToolInProgress?: (v: boolean) => void;
    pushApiMetricsEntry?: (ttftMs: number) => void;
    setStreamMode?: (mode: SpinnerMode) => void;
    onCompactProgress?: (event: CompactProgressEvent) => void;
    setSDKStatus?: (status: SDKStatus) => void;
    openMessageSelector?: () => void;
    setConversationId?: (id: UUID) => void;
    fileReadingLimits?: {
        maxTokens?: number;
        maxSizeBytes?: number;
    };
    globLimits?: {
        maxResults?: number;
    };
    toolDecisions?: Map<string, {
        source: string;
        decision: 'accept' | 'reject';
        timestamp: number;
    }>;
    requestPrompt?: (sourceName: string, toolInputSummary?: string | null) => (request: PromptRequest) => Promise<PromptResponse>;
    criticalSystemReminder_EXPERIMENTAL?: string;
    langfuseTrace?: LangfuseSpan | null;
    langfuseBatchSpan?: LangfuseSpan | null;
    preserveToolUseResults?: boolean;
    renderedSystemPrompt?: SystemPrompt;
}
export interface MessageSelectorOptions {
    messages?: unknown[];
    onSelect?: (selected: unknown) => void;
    onCancel?: () => void;
    title?: string;
}
/**
 * ToolUseContext — 向后兼容类型别名
 *
 * @deprecated 使用 UIToolContext 或 CoreToolContext 替代
 */
export type ToolUseContext = UIToolContext;
/**
 * 创建最小化的 CoreToolContext
 *
 * 用于 non-CLI 环境的工具执行。
 */
export declare function createCoreToolContext(options: {
    cwd: string;
    signal?: AbortSignal;
    readFileCache: FileStateCache;
    getAppState: () => AppState;
    setAppState: (fn: (prev: AppState) => AppState) => void;
    canUseTool: CanUseToolFn;
    toolOptions: CoreToolContext['options'];
    messages: Message[];
}): CoreToolContext;
/**
 * 创建完整的 UIToolContext
 *
 * 用于 CLI 环境的工具执行。
 */
export declare function createUIToolContext(coreContext: CoreToolContext, uiOptions: {
    setToolJSX?: SetToolJSXFn;
    appendSystemMessage?: (message: SystemMessage) => void;
    sendOSNotification?: (opts: {
        message: string;
        notificationType: string;
    }) => void;
    verbose?: boolean;
}): UIToolContext;
//# sourceMappingURL=toolContext.d.ts.map