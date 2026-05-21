import type { BetaUsage as Usage } from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs';
import type { AssistantMessage, Message } from '../types/message.js';
export declare function getTokenUsage(message: Message): Usage | undefined;
/**
 * Calculate total context window tokens from an API response's usage data.
 * Includes input_tokens + cache tokens + output_tokens.
 *
 * This represents the full context size at the time of that API call.
 * Use tokenCountWithEstimation() when you need context size from messages.
 */
export declare function getTokenCountFromUsage(usage: Usage): number;
export declare function tokenCountFromLastAPIResponse(messages: Message[]): number;
/**
 * Final context window size from the last API response's usage.iterations[-1].
 * Used for task_budget.remaining computation across compaction boundaries —
 * the server's budget countdown is context-based, so remaining decrements by
 * the pre-compact final window, not billing spend. See monorepo
 * api/api/sampling/prompt/renderer.py:292 for the server-side computation.
 *
 * Falls back to top-level input_tokens + output_tokens when iterations is
 * absent (no server-side tool loops, so top-level usage IS the final window).
 * Both paths exclude cache tokens to match #304930's formula.
 */
export declare function finalContextTokensFromLastResponse(messages: Message[]): number;
/**
 * Get only the output_tokens from the last API response.
 * This excludes input context (system prompt, tools, prior messages).
 *
 * WARNING: Do NOT use this for threshold comparisons (autocompact, session memory).
 * Use tokenCountWithEstimation() instead, which measures full context size.
 * This function is only useful for measuring how many tokens Claude generated
 * in a single response, not how full the context window is.
 */
export declare function messageTokenCountFromLastAPIResponse(messages: Message[]): number;
export declare function getCurrentUsage(messages: Message[]): {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
} | null;
export declare function doesMostRecentAssistantMessageExceed200k(messages: Message[]): boolean;
/**
 * Calculate the character content length of an assistant message.
 * Used for spinner token estimation (characters / 4 ≈ tokens).
 * This is used when subagent streaming events are filtered out and we
 * need to count content from completed messages instead.
 *
 * Counts the same content that handleMessageFromStream would count via deltas:
 * - text (text_delta)
 * - thinking (thinking_delta)
 * - redacted_thinking data
 * - tool_use input (input_json_delta)
 * Note: signature_delta is excluded from streaming counts (not model output).
 */
export declare function getAssistantMessageContentLength(message: AssistantMessage): number;
/**
 * Get the current context window size in tokens.
 *
 * This is the CANONICAL function for measuring context size when checking
 * thresholds (autocompact, session memory init, etc.). Uses the last API
 * response's token count (input + output + cache) plus estimates for any
 * messages added since.
 *
 * Always use this instead of:
 * - Cumulative token counting (which double-counts as context grows)
 * - messageTokenCountFromLastAPIResponse (which only counts output_tokens)
 * - tokenCountFromLastAPIResponse (which doesn't estimate new messages)
 *
 * Implementation note on parallel tool calls: when the model makes multiple
 * tool calls in one response, the streaming code emits a SEPARATE assistant
 * record per content block (all sharing the same message.id and usage), and
 * the query loop interleaves each tool_result immediately after its tool_use.
 * So the messages array looks like:
 *   [..., assistant(id=A), user(result), assistant(id=A), user(result), ...]
 * If we stop at the LAST assistant record, we only estimate the one tool_result
 * after it and miss all the earlier interleaved tool_results — which will ALL
 * be in the next API request. To avoid undercounting, after finding a usage-
 * bearing record we walk back to the FIRST sibling with the same message.id
 * so every interleaved tool_result is included in the rough estimate.
 */
export declare function tokenCountWithEstimation(messages: readonly Message[]): number;
//# sourceMappingURL=tokens.d.ts.map