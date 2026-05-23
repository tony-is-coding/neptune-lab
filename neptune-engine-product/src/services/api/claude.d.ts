import type { BetaJSONOutputFormat, BetaMessage, BetaMessageDeltaUsage, BetaMessageStreamParams, BetaOutputConfig, BetaRawMessageStreamEvent, BetaToolChoiceAuto, BetaToolChoiceTool, BetaToolUnion, BetaMessageParam as MessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs';
import type { TextBlockParam } from '@anthropic-ai/sdk/resources/index.mjs';
import type { Stream } from '@anthropic-ai/sdk/streaming.mjs';
import { type QueryChainTracking, type ToolPermissionContext, type Tools } from '../../Tool.js';
import type { AgentDefinition } from '@neptune/builtin-tools/tools/AgentTool/loadAgentsDir.js';
import type { AssistantMessage, Message, StreamEvent, SystemAPIErrorMessage, UserMessage } from '../../types/message.js';
import { type CacheScope } from '../../utils/api.js';
import { type SystemPrompt } from '../../utils/systemPromptType.js';
import type { ClientOptions } from '@anthropic-ai/sdk';
import type { QuerySource } from 'src/constants/querySource.js';
import type { Notification } from '../../types/notification.js';
import type { AgentId } from 'src/types/ids.js';
import { type EffortValue } from 'src/utils/effort.js';
import { type ThinkingConfig } from 'src/utils/thinking.js';
import type { LangfuseSpan } from '../langfuse/index.js';
import { type NonNullableUsage } from './logging.js';
import { type RetryContext } from './withRetry.js';
type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
type JsonObject = {
    [key: string]: JsonValue;
};
type JsonArray = JsonValue[];
/**
 * Assemble the extra body parameters for the API request, based on the
 * CLAUDE_CODE_EXTRA_BODY environment variable if present and on any beta
 * headers (primarily for Bedrock requests).
 *
 * @param betaHeaders - An array of beta headers to include in the request.
 * @returns A JSON object representing the extra body parameters.
 */
export declare function getExtraBodyParams(betaHeaders?: string[]): JsonObject;
export declare function getPromptCachingEnabled(model: string): boolean;
export declare function getCacheControl({ scope, querySource, }?: {
    scope?: CacheScope;
    querySource?: QuerySource;
}): {
    type: 'ephemeral';
    ttl?: '1h';
    scope?: CacheScope;
};
type TaskBudgetParam = {
    type: 'tokens';
    total: number;
    remaining?: number;
};
export declare function configureTaskBudgetParams(taskBudget: Options['taskBudget'], outputConfig: BetaOutputConfig & {
    task_budget?: TaskBudgetParam;
}, betas: string[]): void;
export declare function getAPIMetadata(): {
    user_id: string;
};
export declare function verifyApiKey(apiKey: string, isNonInteractiveSession: boolean): Promise<boolean>;
export declare function userMessageToMessageParam(message: UserMessage, addCache: boolean, enablePromptCaching: boolean, querySource?: QuerySource): MessageParam;
export declare function assistantMessageToMessageParam(message: AssistantMessage, addCache: boolean, enablePromptCaching: boolean, querySource?: QuerySource): MessageParam;
export type Options = {
    getToolPermissionContext: () => Promise<ToolPermissionContext>;
    model: string;
    toolChoice?: BetaToolChoiceTool | BetaToolChoiceAuto | undefined;
    isNonInteractiveSession: boolean;
    extraToolSchemas?: BetaToolUnion[];
    maxOutputTokensOverride?: number;
    fallbackModel?: string;
    onStreamingFallback?: () => void;
    querySource: QuerySource;
    agents: AgentDefinition[];
    allowedAgentTypes?: string[];
    hasAppendSystemPrompt: boolean;
    /** Agent 身份覆盖：精确替换 CC 默认身份前缀（"You are Claude Code..." → "你是财务分析 Agent..."） */
    identityOverride?: string;
    fetchOverride?: ClientOptions['fetch'];
    enablePromptCaching?: boolean;
    skipCacheWrite?: boolean;
    temperatureOverride?: number;
    effortValue?: EffortValue;
    mcpTools: Tools;
    hasPendingMcpServers?: boolean;
    queryTracking?: QueryChainTracking;
    agentId?: AgentId;
    outputFormat?: BetaJSONOutputFormat;
    fastMode?: boolean;
    advisorModel?: string;
    addNotification?: (notif: Notification | Record<string, unknown>) => void;
    taskBudget?: {
        total: number;
        remaining?: number;
    };
    /** Langfuse root trace span for observability. No-op if null/undefined. */
    langfuseTrace?: LangfuseSpan | null;
};
export declare function queryModelWithoutStreaming({ messages, systemPrompt, thinkingConfig, tools, signal, options, }: {
    messages: Message[];
    systemPrompt: SystemPrompt;
    thinkingConfig: ThinkingConfig;
    tools: Tools;
    signal: AbortSignal;
    options: Options;
}): Promise<AssistantMessage>;
export declare function queryModelWithStreaming({ messages, systemPrompt, thinkingConfig, tools, signal, options, }: {
    messages: Message[];
    systemPrompt: SystemPrompt;
    thinkingConfig: ThinkingConfig;
    tools: Tools;
    signal: AbortSignal;
    options: Options;
}): AsyncGenerator<StreamEvent | AssistantMessage | SystemAPIErrorMessage, void>;
/**
 * Helper generator for non-streaming API requests.
 * Encapsulates the common pattern of creating a withRetry generator,
 * iterating to yield system messages, and returning the final BetaMessage.
 */
export declare function executeNonStreamingRequest(clientOptions: {
    model: string;
    fetchOverride?: Options['fetchOverride'];
    source: string;
}, retryOptions: {
    model: string;
    fallbackModel?: string;
    thinkingConfig: ThinkingConfig;
    fastMode?: boolean;
    signal: AbortSignal;
    initialConsecutive529Errors?: number;
    querySource?: QuerySource;
}, paramsFromContext: (context: RetryContext) => BetaMessageStreamParams, onAttempt: (attempt: number, start: number, maxOutputTokens: number) => void, captureRequest: (params: BetaMessageStreamParams) => void, 
/**
 * Request ID of the failed streaming attempt this fallback is recovering
 * from. Emitted in tengu_nonstreaming_fallback_error for funnel correlation.
 */
originatingRequestId?: string | null): AsyncGenerator<SystemAPIErrorMessage, BetaMessage>;
/**
 * Ensures messages contain at most `limit` media items (images + documents).
 * Strips oldest media first to preserve the most recent.
 */
export declare function stripExcessMediaItems(messages: (UserMessage | AssistantMessage)[], limit: number): (UserMessage | AssistantMessage)[];
/**
 * Cleans up stream resources to prevent memory leaks.
 * @internal Exported for testing
 */
export declare function cleanupStream(stream: Stream<BetaRawMessageStreamEvent> | undefined): void;
/**
 * Updates usage statistics with new values from streaming API events.
 * Note: Anthropic's streaming API provides cumulative usage totals, not incremental deltas.
 * Each event contains the complete usage up to that point in the stream.
 *
 * Input-related tokens (input_tokens, cache_creation_input_tokens, cache_read_input_tokens)
 * are typically set in message_start and remain constant. message_delta events may send
 * explicit 0 values for these fields, which should not overwrite the values from message_start.
 * We only update these fields if they have a non-null, non-zero value.
 */
export declare function updateUsage(usage: Readonly<NonNullableUsage>, partUsage: BetaMessageDeltaUsage | undefined): NonNullableUsage;
/**
 * Accumulates usage from one message into a total usage object.
 * Used to track cumulative usage across multiple assistant turns.
 */
export declare function accumulateUsage(totalUsage: Readonly<NonNullableUsage>, messageUsage: Readonly<NonNullableUsage>): NonNullableUsage;
type CachedMCEditsBlock = {
    type: 'cache_edits';
    edits: {
        type: 'delete';
        cache_reference: string;
    }[];
};
type CachedMCPinnedEdits = {
    userMessageIndex: number;
    block: CachedMCEditsBlock;
};
export declare function addCacheBreakpoints(messages: (UserMessage | AssistantMessage)[], enablePromptCaching: boolean, querySource?: QuerySource, useCachedMC?: boolean, newCacheEdits?: CachedMCEditsBlock | null, pinnedEdits?: CachedMCPinnedEdits[], skipCacheWrite?: boolean): MessageParam[];
export declare function buildSystemPromptBlocks(systemPrompt: SystemPrompt, enablePromptCaching: boolean, options?: {
    skipGlobalCacheForSystemPrompt?: boolean;
    querySource?: QuerySource;
}): TextBlockParam[];
type HaikuOptions = Omit<Options, 'model' | 'getToolPermissionContext'>;
export declare function queryHaiku({ systemPrompt, userPrompt, outputFormat, signal, options, }: {
    systemPrompt: SystemPrompt;
    userPrompt: string;
    outputFormat?: BetaJSONOutputFormat;
    signal: AbortSignal;
    options: HaikuOptions;
}): Promise<AssistantMessage>;
type QueryWithModelOptions = Omit<Options, 'getToolPermissionContext'>;
/**
 * Query a specific model through the Claude Code infrastructure.
 * This goes through the full query pipeline including proper authentication,
 * betas, and headers - unlike direct API calls.
 */
export declare function queryWithModel({ systemPrompt, userPrompt, outputFormat, signal, options, }: {
    systemPrompt: SystemPrompt;
    userPrompt: string;
    outputFormat?: BetaJSONOutputFormat;
    signal: AbortSignal;
    options: QueryWithModelOptions;
}): Promise<AssistantMessage>;
export declare const MAX_NON_STREAMING_TOKENS = 64000;
/**
 * Adjusts thinking budget when max_tokens is capped for non-streaming fallback.
 * Ensures the API constraint: max_tokens > thinking.budget_tokens
 *
 * @param params - The parameters that will be sent to the API
 * @param maxTokensCap - The maximum allowed tokens (MAX_NON_STREAMING_TOKENS)
 * @returns Adjusted parameters with thinking budget capped if needed
 */
export declare function adjustParamsForNonStreaming<T extends {
    max_tokens: number;
    thinking?: BetaMessageStreamParams['thinking'];
}>(params: T, maxTokensCap: number): T;
export declare function getMaxOutputTokensForModel(model: string): number;
export {};
//# sourceMappingURL=claude.d.ts.map