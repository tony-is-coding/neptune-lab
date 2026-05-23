import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.mjs';
import type { SDKMessage, SDKStatus } from 'src/entrypoints/agentSdkTypes.js';
import type { Command } from './types/command.js';
import type { ICommandProvider } from './types/commandProvider.js';
import type { CanUseToolFn } from './types/permissions.js';
import type { QueryDeps } from './query/deps.js';
import type { MCPServerConnection } from './services/mcp/types.js';
import type { AppState } from './state/AppStateStore.js';
import { type Tools, type ToolUseContext } from './Tool.js';
import type { AgentDefinition } from '@neptune/builtin-tools/tools/AgentTool/loadAgentsDir.js';
import type { Message } from './types/message.js';
import type { OrphanedPermission } from './types/textInputTypes.js';
import { type FileStateCache } from './utils/fileStateCache.js';
import { type ThinkingConfig } from './utils/thinking.js';
export type QueryEngineConfig = {
    cwd: string;
    tools: Tools;
    commands: Command[];
    mcpClients: MCPServerConnection[];
    agents: AgentDefinition[];
    canUseTool: CanUseToolFn;
    getAppState: () => AppState;
    setAppState: (f: (prev: AppState) => AppState) => void;
    /** 命令提供者接口（可选，未提供时使用默认实现） */
    commandProvider?: ICommandProvider;
    initialMessages?: Message[];
    readFileCache: FileStateCache;
    customSystemPrompt?: string;
    appendSystemPrompt?: string;
    /** Agent 身份覆盖：精确替换 CC 默认身份前缀 */
    identityOverride?: string;
    userSpecifiedModel?: string;
    fallbackModel?: string;
    thinkingConfig?: ThinkingConfig;
    maxTurns?: number;
    maxBudgetUsd?: number;
    taskBudget?: {
        total: number;
    };
    jsonSchema?: Record<string, unknown>;
    verbose?: boolean;
    replayUserMessages?: boolean;
    /** Handler for URL elicitations triggered by MCP tool -32042 errors. */
    handleElicitation?: ToolUseContext['handleElicitation'];
    includePartialMessages?: boolean;
    setSDKStatus?: (status: SDKStatus) => void;
    abortController?: AbortController;
    orphanedPermission?: OrphanedPermission;
    /**
     * Snip-boundary handler: receives each yielded system message plus the
     * current mutableMessages store. Returns undefined if the message is not a
     * snip boundary; otherwise returns the replayed snip result. Injected by
     * ask() when HISTORY_SNIP is enabled so feature-gated strings stay inside
     * the gated module (keeps QueryEngine free of excluded strings and testable
     * despite feature() returning false under bun test). SDK-only: the REPL
     * keeps full history for UI scrollback and projects on demand via
     * projectSnippedView; QueryEngine truncates here to bound memory in long
     * headless sessions (no UI to preserve).
     */
    snipReplay?: (yieldedSystemMsg: Message, store: Message[]) => {
        messages: Message[];
        executed: boolean;
    } | undefined;
    /**
     * 自定义依赖注入（Provider 运行时接入）
     *
     * 当指定 provider.type 时，Bridge 层会注入 ProviderAdapter 包装的 callModel，
     * 实现对不同 LLM Provider 的统一调用。
     */
    customDeps?: QueryDeps;
};
/**
 * QueryEngine owns the query lifecycle and session state for a conversation.
 * It extracts the core logic from ask() into a standalone class that can be
 * used by both the headless/SDK path and (in a future phase) the REPL.
 *
 * One QueryEngine per conversation. Each submitMessage() call starts a new
 * turn within the same conversation. State (messages, file cache, usage, etc.)
 * persists across turns.
 */
export declare class QueryEngine {
    private config;
    private mutableMessages;
    private abortController;
    private permissionDenials;
    private totalUsage;
    private hasHandledOrphanedPermission;
    private readFileState;
    private discoveredSkillNames;
    private loadedNestedMemoryPaths;
    constructor(config: QueryEngineConfig);
    submitMessage(prompt: string | ContentBlockParam[], options?: {
        uuid?: string;
        isMeta?: boolean;
    }): AsyncGenerator<SDKMessage, void, unknown>;
    interrupt(): void;
    getMessages(): readonly Message[];
    getReadFileState(): FileStateCache;
    getSessionId(): string;
    setModel(model: string): void;
}
/**
 * Sends a single prompt to the Claude API and returns the response.
 * Assumes that claude is being used non-interactively -- will not
 * ask the user for permissions or further input.
 *
 * Convenience wrapper around QueryEngine for one-shot usage.
 */
export declare function ask({ commands, prompt, promptUuid, isMeta, cwd, tools, mcpClients, verbose, thinkingConfig, maxTurns, maxBudgetUsd, taskBudget, canUseTool, mutableMessages, getReadFileCache, setReadFileCache, customSystemPrompt, appendSystemPrompt, userSpecifiedModel, fallbackModel, jsonSchema, getAppState, setAppState, abortController, replayUserMessages, includePartialMessages, handleElicitation, agents, setSDKStatus, orphanedPermission, commandProvider, }: {
    commands: Command[];
    prompt: string | Array<ContentBlockParam>;
    promptUuid?: string;
    isMeta?: boolean;
    cwd: string;
    tools: Tools;
    verbose?: boolean;
    mcpClients: MCPServerConnection[];
    thinkingConfig?: ThinkingConfig;
    maxTurns?: number;
    maxBudgetUsd?: number;
    taskBudget?: {
        total: number;
    };
    canUseTool: CanUseToolFn;
    mutableMessages?: Message[];
    customSystemPrompt?: string;
    appendSystemPrompt?: string;
    userSpecifiedModel?: string;
    fallbackModel?: string;
    jsonSchema?: Record<string, unknown>;
    getAppState: () => AppState;
    setAppState: (f: (prev: AppState) => AppState) => void;
    getReadFileCache: () => FileStateCache;
    setReadFileCache: (cache: FileStateCache) => void;
    abortController?: AbortController;
    replayUserMessages?: boolean;
    includePartialMessages?: boolean;
    handleElicitation?: ToolUseContext['handleElicitation'];
    agents?: AgentDefinition[];
    setSDKStatus?: (status: SDKStatus) => void;
    orphanedPermission?: OrphanedPermission;
    commandProvider?: ICommandProvider;
}): AsyncGenerator<SDKMessage, void, unknown>;
//# sourceMappingURL=QueryEngine.d.ts.map