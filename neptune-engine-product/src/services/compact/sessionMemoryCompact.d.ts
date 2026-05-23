/**
 * EXPERIMENT: Session memory compaction
 */
import type { AgentId } from '../../types/ids.js';
import type { Message } from '../../types/message.js';
import { type CompactionResult } from './compact.js';
/**
 * Configuration for session memory compaction thresholds
 */
export type SessionMemoryCompactConfig = {
    /** Minimum tokens to preserve after compaction */
    minTokens: number;
    /** Minimum number of messages with text blocks to keep */
    minTextBlockMessages: number;
    /** Maximum tokens to preserve after compaction (hard cap) */
    maxTokens: number;
};
export declare const DEFAULT_SM_COMPACT_CONFIG: SessionMemoryCompactConfig;
/**
 * Set the session memory compact configuration
 */
export declare function setSessionMemoryCompactConfig(config: Partial<SessionMemoryCompactConfig>): void;
/**
 * Get the current session memory compact configuration
 */
export declare function getSessionMemoryCompactConfig(): SessionMemoryCompactConfig;
/**
 * Reset config state (useful for testing)
 */
export declare function resetSessionMemoryCompactConfig(): void;
/**
 * Check if a message contains text blocks (text content for user/assistant interaction)
 */
export declare function hasTextBlocks(message: Message): boolean;
/**
 * Adjust the start index to ensure we don't split tool_use/tool_result pairs
 * or thinking blocks that share the same message.id with kept assistant messages.
 *
 * If ANY message we're keeping contains tool_result blocks, we need to
 * include the preceding assistant message(s) that contain the matching tool_use blocks.
 *
 * Additionally, if ANY assistant message in the kept range has the same message.id
 * as a preceding assistant message (which may contain thinking blocks), we need to
 * include those messages so they can be properly merged by normalizeMessagesForAPI.
 *
 * This handles the case where streaming yields separate messages per content block
 * (thinking, tool_use, etc.) with the same message.id but different uuids. If the
 * startIndex lands on one of these streaming messages, we need to look at ALL kept
 * messages for tool_results, not just the first one.
 *
 * Example bug scenarios this fixes:
 *
 * Tool pair scenario:
 *   Session storage (before compaction):
 *     Index N:   assistant, message.id: X, content: [thinking]
 *     Index N+1: assistant, message.id: X, content: [tool_use: ORPHAN_ID]
 *     Index N+2: assistant, message.id: X, content: [tool_use: VALID_ID]
 *     Index N+3: user, content: [tool_result: ORPHAN_ID, tool_result: VALID_ID]
 *
 *   If startIndex = N+2:
 *     - Old code: checked only message N+2 for tool_results, found none, returned N+2
 *     - After slicing and normalizeMessagesForAPI merging by message.id:
 *       msg[1]: assistant with [tool_use: VALID_ID]  (ORPHAN tool_use was excluded!)
 *       msg[2]: user with [tool_result: ORPHAN_ID, tool_result: VALID_ID]
 *     - API error: orphan tool_result references non-existent tool_use
 *
 * Thinking block scenario:
 *   Session storage (before compaction):
 *     Index N:   assistant, message.id: X, content: [thinking]
 *     Index N+1: assistant, message.id: X, content: [tool_use: ID]
 *     Index N+2: user, content: [tool_result: ID]
 *
 *   If startIndex = N+1:
 *     - Without this fix: thinking block at N is excluded
 *     - After normalizeMessagesForAPI: thinking block is lost (no message to merge with)
 *
 *   Fixed code: detects that message N+1 has same message.id as N, adjusts to N.
 */
export declare function adjustIndexToPreserveAPIInvariants(messages: Message[], startIndex: number): number;
/**
 * Calculate the starting index for messages to keep after compaction.
 * Starts from lastSummarizedMessageId, then expands backwards to meet minimums:
 * - At least config.minTokens tokens
 * - At least config.minTextBlockMessages messages with text blocks
 * Stops expanding if config.maxTokens is reached.
 * Also ensures tool_use/tool_result pairs are not split.
 */
export declare function calculateMessagesToKeepIndex(messages: Message[], lastSummarizedIndex: number): number;
/**
 * Check if we should use session memory for compaction
 * Uses cached gate values to avoid blocking on Statsig initialization
 */
export declare function shouldUseSessionMemoryCompaction(): boolean;
/**
 * Try to use session memory for compaction instead of traditional compaction.
 * Returns null if session memory compaction cannot be used.
 *
 * Handles two scenarios:
 * 1. Normal case: lastSummarizedMessageId is set, keep only messages after that ID
 * 2. Resumed session: lastSummarizedMessageId is not set but session memory has content,
 *    keep all messages but use session memory as the summary
 */
export declare function trySessionMemoryCompaction(messages: Message[], agentId?: AgentId, autoCompactThreshold?: number): Promise<CompactionResult | null>;
//# sourceMappingURL=sessionMemoryCompact.d.ts.map