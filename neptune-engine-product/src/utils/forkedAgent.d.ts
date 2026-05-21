/**
 * Helper for running forked agent query loops with usage tracking.
 *
 * This utility ensures forked agents:
 * 1. Share identical cache-critical params with the parent to guarantee prompt cache hits
 * 2. Track full usage metrics across the entire query loop
 * 3. Log metrics via the tengu_fork_agent_query event when complete
 * 4. Isolate mutable state to prevent interference with the main agent loop
 */
import type { PromptCommand } from '../commands.js';
import type { QuerySource } from '../constants/querySource.js';
import type { CanUseToolFn } from '../types/permissions.js';
import { type NonNullableUsage } from '../services/api/logging.js';
import type { ToolUseContext } from '../Tool.js';
import type { AgentDefinition } from '@neptune/builtin-tools/tools/AgentTool/loadAgentsDir.js';
import type { AgentId } from '../types/ids.js';
import type { Message } from '../types/message.js';
import type { REPLHookContext } from './hooks/postSamplingHooks.js';
import type { SystemPrompt } from './systemPromptType.js';
import { type ContentReplacementState } from './toolResultStorage.js';
/**
 * Parameters that must be identical between the fork and parent API requests
 * to share the parent's prompt cache. The Anthropic API cache key is composed of:
 * system prompt, tools, model, messages (prefix), and thinking config.
 *
 * CacheSafeParams carries the first five. Thinking config is derived from the
 * inherited toolUseContext.options.thinkingConfig — but can be inadvertently
 * changed if the fork sets maxOutputTokens, which clamps budget_tokens in
 * claude.ts (but only for older models that do not use adaptive thinking).
 * See the maxOutputTokens doc on ForkedAgentParams.
 */
export type CacheSafeParams = {
    /** System prompt - must match parent for cache hits */
    systemPrompt: SystemPrompt;
    /** User context - prepended to messages, affects cache */
    userContext: {
        [k: string]: string;
    };
    /** System context - appended to system prompt, affects cache */
    systemContext: {
        [k: string]: string;
    };
    /** Tool use context containing tools, model, and other options */
    toolUseContext: ToolUseContext;
    /** Parent context messages for prompt cache sharing */
    forkContextMessages: Message[];
};
export declare function saveCacheSafeParams(params: CacheSafeParams | null): void;
export declare function getLastCacheSafeParams(): CacheSafeParams | null;
export type ForkedAgentParams = {
    /** Messages to start the forked query loop with */
    promptMessages: Message[];
    /** Cache-safe parameters that must match the parent query */
    cacheSafeParams: CacheSafeParams;
    /** Permission check function for the forked agent */
    canUseTool: CanUseToolFn;
    /** Source identifier for tracking */
    querySource: QuerySource;
    /** Label for analytics (e.g., 'session_memory', 'supervisor') */
    forkLabel: string;
    /** Optional overrides for the subagent context (e.g., readFileState from setup phase) */
    overrides?: SubagentContextOverrides;
    /**
     * Optional cap on output tokens. CAUTION: setting this changes both max_tokens
     * AND budget_tokens (via clamping in claude.ts). If the fork uses cacheSafeParams
     * to share the parent's prompt cache, a different budget_tokens will invalidate
     * the cache — thinking config is part of the cache key. Only set this when cache
     * sharing is not a goal (e.g., compact summaries).
     */
    maxOutputTokens?: number;
    /** Optional cap on number of turns (API round-trips) */
    maxTurns?: number;
    /** Optional callback invoked for each message as it arrives (for streaming UI) */
    onMessage?: (message: Message) => void;
    /** Skip sidechain transcript recording (e.g., for ephemeral work like speculation) */
    skipTranscript?: boolean;
    /** Skip writing new prompt cache entries on the last message. For
     *  fire-and-forget forks where no future request will read from this prefix. */
    skipCacheWrite?: boolean;
};
export type ForkedAgentResult = {
    /** All messages yielded during the query loop */
    messages: Message[];
    /** Accumulated usage across all API calls in the loop */
    totalUsage: NonNullableUsage;
};
/**
 * Creates CacheSafeParams from REPLHookContext.
 * Use this helper when forking from a post-sampling hook context.
 *
 * To override specific fields (e.g., toolUseContext with cloned file state),
 * spread the result and override: `{ ...createCacheSafeParams(context), toolUseContext: clonedContext }`
 *
 * @param context - The REPLHookContext from the post-sampling hook
 */
export declare function createCacheSafeParams(context: REPLHookContext): CacheSafeParams;
/**
 * Creates a modified getAppState that adds allowed tools to the permission context.
 * This is used by forked skill/command execution to grant tool permissions.
 */
export declare function createGetAppStateWithAllowedTools(baseGetAppState: ToolUseContext['getAppState'], allowedTools: string[]): ToolUseContext['getAppState'];
/**
 * Result from preparing a forked command context.
 */
export type PreparedForkedContext = {
    /** Skill content with args replaced */
    skillContent: string;
    /** Modified getAppState with allowed tools */
    modifiedGetAppState: ToolUseContext['getAppState'];
    /** The general-purpose agent to use */
    baseAgent: AgentDefinition;
    /** Initial prompt messages */
    promptMessages: Message[];
};
/**
 * Prepares the context for executing a forked command/skill.
 * This handles the common setup that both SkillTool and slash commands need.
 */
export declare function prepareForkedCommandContext(command: PromptCommand, args: string, context: ToolUseContext): Promise<PreparedForkedContext>;
/**
 * Extracts result text from agent messages.
 */
export declare function extractResultText(agentMessages: Message[], defaultText?: string): string;
/**
 * Options for creating a subagent context.
 *
 * By default, all mutable state is isolated to prevent interference with the parent.
 * Use these options to:
 * - Override specific fields (e.g., custom options, agentId, messages)
 * - Explicitly opt-in to sharing specific callbacks (for interactive subagents)
 */
export type SubagentContextOverrides = {
    /** Override the options object (e.g., custom tools, model) */
    options?: ToolUseContext['options'];
    /** Override the agentId (for subagents with their own ID) */
    agentId?: AgentId;
    /** Override the agentType (for subagents with a specific type) */
    agentType?: string;
    /** Override the messages array */
    messages?: Message[];
    /** Override the readFileState (e.g., fresh cache instead of clone) */
    readFileState?: ToolUseContext['readFileState'];
    /** Override the abortController */
    abortController?: AbortController;
    /** Override the getAppState function */
    getAppState?: ToolUseContext['getAppState'];
    /**
     * Explicit opt-in to share parent's setAppState callback.
     * Use for interactive subagents that need to update shared state.
     * @default false (isolated no-op)
     */
    shareSetAppState?: boolean;
    /**
     * Explicit opt-in to share parent's setResponseLength callback.
     * Use for subagents that contribute to parent's response metrics.
     * @default false (isolated no-op)
     */
    shareSetResponseLength?: boolean;
    /**
     * Explicit opt-in to share parent's abortController.
     * Use for interactive subagents that should abort with parent.
     * Note: Only applies if abortController override is not provided.
     * @default false (new controller linked to parent)
     */
    shareAbortController?: boolean;
    /** Critical system reminder to re-inject at every user turn */
    criticalSystemReminder_EXPERIMENTAL?: string;
    /** When true, canUseTool must always be called even when hooks auto-approve.
     *  Used by speculation for overlay file path rewriting. */
    requireCanUseTool?: boolean;
    /** Override replacement state — used by resumeAgentBackground to thread
     * state reconstructed from the resumed sidechain so the same results
     * are re-replaced (prompt cache stability). */
    contentReplacementState?: ContentReplacementState;
};
/**
 * Creates an isolated ToolUseContext for subagents.
 *
 * By default, ALL mutable state is isolated to prevent interference:
 * - readFileState: cloned from parent
 * - abortController: new controller linked to parent (parent abort propagates)
 * - getAppState: wrapped to set shouldAvoidPermissionPrompts
 * - All mutation callbacks (setAppState, etc.): no-op
 * - Fresh collections: nestedMemoryAttachmentTriggers, toolDecisions
 *
 * Callers can:
 * - Override specific fields via the overrides parameter
 * - Explicitly opt-in to sharing specific callbacks (shareSetAppState, etc.)
 *
 * @param parentContext - The parent's ToolUseContext to create subagent context from
 * @param overrides - Optional overrides and sharing options
 *
 * @example
 * // Full isolation (for background agents like session memory)
 * const ctx = createSubagentContext(parentContext)
 *
 * @example
 * // Custom options and agentId (for AgentTool async agents)
 * const ctx = createSubagentContext(parentContext, {
 *   options: customOptions,
 *   agentId: newAgentId,
 *   messages: initialMessages,
 * })
 *
 * @example
 * // Interactive subagent that shares some state
 * const ctx = createSubagentContext(parentContext, {
 *   options: customOptions,
 *   agentId: newAgentId,
 *   shareSetAppState: true,
 *   shareSetResponseLength: true,
 *   shareAbortController: true,
 * })
 */
export declare function createSubagentContext(parentContext: ToolUseContext, overrides?: SubagentContextOverrides): ToolUseContext;
/**
 * Runs a forked agent query loop and tracks cache hit metrics.
 *
 * This function:
 * 1. Uses identical cache-safe params from parent to enable prompt caching
 * 2. Accumulates usage across all query iterations
 * 3. Logs tengu_fork_agent_query with full usage when complete
 *
 * @example
 * ```typescript
 * const result = await runForkedAgent({
 *   promptMessages: [createUserMessage({ content: userPrompt })],
 *   cacheSafeParams: {
 *     systemPrompt,
 *     userContext,
 *     systemContext,
 *     toolUseContext: clonedToolUseContext,
 *     forkContextMessages: messages,
 *   },
 *   canUseTool,
 *   querySource: 'session_memory',
 *   forkLabel: 'session_memory',
 * })
 * ```
 */
export declare function runForkedAgent({ promptMessages, cacheSafeParams, canUseTool, querySource, forkLabel, overrides, maxOutputTokens, maxTurns, onMessage, skipTranscript, skipCacheWrite, }: ForkedAgentParams): Promise<ForkedAgentResult>;
//# sourceMappingURL=forkedAgent.d.ts.map