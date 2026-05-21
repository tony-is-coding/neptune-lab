/**
 * Beta Session Tracing for Claude Code
 *
 * This module contains beta tracing features enabled when
 * ENABLE_BETA_TRACING_DETAILED=1 and BETA_TRACING_ENDPOINT are set.
 *
 * For external users, tracing is enabled in SDK/headless mode, or in
 * interactive mode when the org is allowlisted via the
 * tengu_trace_lantern GrowthBook gate.
 * For ant users, tracing is enabled in all modes.
 *
 * Visibility Rules:
 * | Content          | External | Ant  |
 * |------------------|----------|------|
 * | System prompts   | ✅                  | ✅   |
 * | Model output     | ✅                  | ✅   |
 * | Thinking output  | ❌                  | ✅   |
 * | Tools            | ✅                  | ✅   |
 * | new_context      | ✅                  | ✅   |
 *
 * Features:
 * - Per-agent message tracking with hash-based deduplication
 * - System prompt logging (once per unique hash)
 * - Hook execution spans
 * - Detailed new_context attributes for LLM requests
 */
import type { Span } from '@opentelemetry/api';
import type { AssistantMessage, UserMessage } from '../../types/message.js';
type APIMessage = UserMessage | AssistantMessage;
/**
 * Clear tracking state after compaction.
 * Old hashes are irrelevant once messages have been replaced.
 */
export declare function clearBetaTracingState(): void;
/**
 * Check if beta detailed tracing is enabled.
 * - Requires ENABLE_BETA_TRACING_DETAILED=1 and BETA_TRACING_ENDPOINT
 * - For external users, enabled in SDK/headless mode OR when org is
 *   allowlisted via the tengu_trace_lantern GrowthBook gate
 */
export declare function isBetaTracingEnabled(): boolean;
/**
 * Truncate content to fit within Honeycomb limits.
 */
export declare function truncateContent(content: string, maxSize?: number): {
    content: string;
    truncated: boolean;
};
export interface LLMRequestNewContext {
    /** System prompt (typically only on first request or if changed) */
    systemPrompt?: string;
    /** Query source identifying the agent/purpose (e.g., 'repl_main_thread', 'agent:builtin') */
    querySource?: string;
    /** Tool schemas sent with the request */
    tools?: string;
}
/**
 * Add beta attributes to an interaction span.
 * Adds new_context with the user prompt.
 */
export declare function addBetaInteractionAttributes(span: Span, userPrompt: string): void;
/**
 * Add beta attributes to an LLM request span.
 * Handles system prompt logging and new_context computation.
 */
export declare function addBetaLLMRequestAttributes(span: Span, newContext?: LLMRequestNewContext, messagesForAPI?: APIMessage[]): void;
/**
 * Add beta attributes to endLLMRequestSpan.
 * Handles model_output and thinking_output truncation.
 */
export declare function addBetaLLMResponseAttributes(endAttributes: Record<string, string | number | boolean>, metadata?: {
    modelOutput?: string;
    thinkingOutput?: string;
}): void;
/**
 * Add beta attributes to startToolSpan.
 * Adds tool_input with the serialized tool input.
 */
export declare function addBetaToolInputAttributes(span: Span, toolName: string, toolInput: string): void;
/**
 * Add beta attributes to endToolSpan.
 * Adds new_context with the tool result.
 */
export declare function addBetaToolResultAttributes(endAttributes: Record<string, string | number | boolean>, toolName: string | number | boolean, toolResult: string): void;
export {};
//# sourceMappingURL=betaSessionTracing.d.ts.map