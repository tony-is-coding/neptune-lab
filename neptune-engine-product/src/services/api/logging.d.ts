import type { BetaStopReason } from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs';
import type { QueryChainTracking } from 'src/Tool.js';
import type { AssistantMessage } from 'src/types/message.js';
import type { EffortLevel } from 'src/utils/effort.js';
import type { PermissionMode } from 'src/utils/permissions/PermissionMode.js';
import { type Span } from 'src/utils/telemetry/sessionTracing.js';
import type { NonNullableUsage } from '../../entrypoints/sdk/sdkUtilityTypes.js';
import { EMPTY_USAGE } from './emptyUsage.js';
export type { NonNullableUsage };
export { EMPTY_USAGE };
export type GlobalCacheStrategy = 'tool_based' | 'system_prompt' | 'none';
export declare function logAPIQuery({ model, messagesLength, temperature, betas, permissionMode, querySource, queryTracking, thinkingType, effortValue, fastMode, previousRequestId, }: {
    model: string;
    messagesLength: number;
    temperature: number;
    betas?: string[];
    permissionMode?: PermissionMode;
    querySource: string;
    queryTracking?: QueryChainTracking;
    thinkingType?: 'adaptive' | 'enabled' | 'disabled';
    effortValue?: EffortLevel | null;
    fastMode?: boolean;
    previousRequestId?: string | null;
}): void;
export declare function logAPIError({ error, model, messageCount, messageTokens, durationMs, durationMsIncludingRetries, attempt, requestId, clientRequestId, didFallBackToNonStreaming, promptCategory, headers, queryTracking, querySource, llmSpan, fastMode, previousRequestId, }: {
    error: unknown;
    model: string;
    messageCount: number;
    messageTokens?: number;
    durationMs: number;
    durationMsIncludingRetries: number;
    attempt: number;
    requestId?: string | null;
    /** Client-generated ID sent as x-client-request-id header (survives timeouts) */
    clientRequestId?: string;
    didFallBackToNonStreaming?: boolean;
    promptCategory?: string;
    headers?: globalThis.Headers;
    queryTracking?: QueryChainTracking;
    querySource?: string;
    /** The span from startLLMRequestSpan - pass this to correctly match responses to requests */
    llmSpan?: Span;
    fastMode?: boolean;
    previousRequestId?: string | null;
}): void;
export declare function logAPISuccessAndDuration({ model, preNormalizedModel, start, startIncludingRetries, ttftMs, usage, attempt, messageCount, messageTokens, requestId, stopReason, didFallBackToNonStreaming, querySource, headers, costUSD, queryTracking, permissionMode, newMessages, llmSpan, globalCacheStrategy, requestSetupMs, attemptStartTimes, fastMode, previousRequestId, betas, }: {
    model: string;
    preNormalizedModel: string;
    start: number;
    startIncludingRetries: number;
    ttftMs: number | null;
    usage: NonNullableUsage;
    attempt: number;
    messageCount: number;
    messageTokens: number;
    requestId: string | null;
    stopReason: BetaStopReason | null;
    didFallBackToNonStreaming: boolean;
    querySource: string;
    headers?: globalThis.Headers;
    costUSD: number;
    queryTracking?: QueryChainTracking;
    permissionMode?: PermissionMode;
    /** Assistant messages from the response - used to extract model_output and thinking_output
     *  when beta tracing is enabled */
    newMessages?: AssistantMessage[];
    /** The span from startLLMRequestSpan - pass this to correctly match responses to requests */
    llmSpan?: Span;
    /** Strategy used for global prompt caching: 'tool_based', 'system_prompt', or 'none' */
    globalCacheStrategy?: GlobalCacheStrategy;
    /** Time spent in pre-request setup before the successful attempt */
    requestSetupMs?: number;
    /** Timestamps (Date.now()) of each attempt start — used for retry sub-spans in Perfetto */
    attemptStartTimes?: number[];
    fastMode?: boolean;
    /** Request ID from the previous API call in this session */
    previousRequestId?: string | null;
    betas?: string[];
}): void;
//# sourceMappingURL=logging.d.ts.map