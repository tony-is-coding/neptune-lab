import type { QuerySource } from '../../constants/querySource.js';
import type { ToolUseContext } from '../../Tool.js';
import type { Message } from '../../types/message.js';
import { type TimeBasedMCConfig } from './timeBasedMCConfig.js';
export declare const TIME_BASED_MC_CLEARED_MESSAGE = "[Old tool result content cleared]";
/**
 * Get new pending cache edits to be included in the next API request.
 * Returns null if there are no new pending edits.
 * Clears the pending state (caller must pin them after insertion).
 */
export declare function consumePendingCacheEdits(): import('./cachedMicrocompact.js').CacheEditsBlock | null;
/**
 * Get all previously-pinned cache edits that must be re-sent at their
 * original positions for cache hits.
 */
export declare function getPinnedCacheEdits(): import('./cachedMicrocompact.js').PinnedCacheEdits[];
/**
 * Pin a new cache_edits block to a specific user message position.
 * Called after inserting new edits so they are re-sent in subsequent calls.
 */
export declare function pinCacheEdits(userMessageIndex: number, block: import('./cachedMicrocompact.js').CacheEditsBlock): void;
/**
 * Marks all registered tools as sent to the API.
 * Called after a successful API response.
 */
export declare function markToolsSentToAPIState(): void;
export declare function resetMicrocompactState(): void;
/**
 * Estimate token count for messages by extracting text content
 * Used for rough token estimation when we don't have accurate API counts
 * Pads estimate by 4/3 to be conservative since we're approximating
 */
export declare function estimateMessageTokens(messages: Message[]): number;
export type PendingCacheEdits = {
    trigger: 'auto';
    deletedToolIds: string[];
    baselineCacheDeletedTokens: number;
};
export type MicrocompactResult = {
    messages: Message[];
    compactionInfo?: {
        pendingCacheEdits?: PendingCacheEdits;
    };
};
export declare function microcompactMessages(messages: Message[], toolUseContext?: ToolUseContext, querySource?: QuerySource): Promise<MicrocompactResult>;
/**
 * Time-based microcompact: when the gap since the last main-loop assistant
 * message exceeds the configured threshold, content-clear all but the most
 * recent N compactable tool results.
 *
 * Returns null when the trigger doesn't fire (disabled, wrong source, gap
 * under threshold, nothing to clear) — caller falls through to other paths.
 *
 * Unlike cached MC, this mutates message content directly. The cache is cold,
 * so there's no cached prefix to preserve via cache_edits.
 */
/**
 * Check whether the time-based trigger should fire for this request.
 *
 * Returns the measured gap (minutes since last assistant message) when the
 * trigger fires, or null when it doesn't (disabled, wrong source, under
 * threshold, no prior assistant, unparseable timestamp).
 *
 * Extracted so other pre-request paths (e.g. snip force-apply) can consult
 * the same predicate without coupling to the tool-result clearing action.
 */
export declare function evaluateTimeBasedTrigger(messages: Message[], querySource: QuerySource | undefined): {
    gapMinutes: number;
    config: TimeBasedMCConfig;
} | null;
//# sourceMappingURL=microCompact.d.ts.map