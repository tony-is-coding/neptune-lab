/**
 * Session Tracing for Claude Code using OpenTelemetry (BETA)
 *
 * This module provides a high-level API for creating and managing spans
 * to trace Claude Code workflows. Each user interaction creates a root
 * interaction span, which contains operation spans (LLM requests, tool calls, etc.).
 *
 * Requirements:
 * - Enhanced telemetry is enabled via feature('ENHANCED_TELEMETRY_BETA')
 * - Configure OTEL_TRACES_EXPORTER (console, otlp, etc.)
 */
import { type Span } from '@opentelemetry/api';
import type { AssistantMessage, UserMessage } from '../../types/message.js';
import { isBetaTracingEnabled, type LLMRequestNewContext } from './betaSessionTracing.js';
export type { Span };
export { isBetaTracingEnabled, type LLMRequestNewContext };
type APIMessage = UserMessage | AssistantMessage;
/**
 * Check if enhanced telemetry is enabled.
 * Priority: env var override > ant build > GrowthBook gate
 */
export declare function isEnhancedTelemetryEnabled(): boolean;
/**
 * Start an interaction span. This wraps a user request -> Claude response cycle.
 * This is now a root span that includes all session-level attributes.
 * Sets the interaction context for all subsequent operations.
 */
export declare function startInteractionSpan(userPrompt: string): Span;
export declare function endInteractionSpan(): void;
export declare function startLLMRequestSpan(model: string, newContext?: LLMRequestNewContext, messagesForAPI?: APIMessage[], fastMode?: boolean): Span;
/**
 * End an LLM request span and attach response metadata.
 *
 * @param span - Optional. The exact span returned by startLLMRequestSpan().
 *   IMPORTANT: When multiple LLM requests run in parallel (e.g., warmup requests,
 *   topic classifier, file path extractor, main thread), you MUST pass the specific span
 *   to ensure responses are attached to the correct request. Without it, responses may be
 *   incorrectly attached to whichever span happens to be "last" in the activeSpans map.
 *
 *   If not provided, falls back to finding the most recent llm_request span (legacy behavior).
 */
export declare function endLLMRequestSpan(span?: Span, metadata?: {
    inputTokens?: number;
    outputTokens?: number;
    cacheReadTokens?: number;
    cacheCreationTokens?: number;
    success?: boolean;
    statusCode?: number;
    error?: string;
    attempt?: number;
    modelResponse?: string;
    /** Text output from the model (non-thinking content) */
    modelOutput?: string;
    /** Thinking/reasoning output from the model */
    thinkingOutput?: string;
    /** Whether the output included tool calls (look at tool spans for details) */
    hasToolCall?: boolean;
    /** Time to first token in milliseconds */
    ttftMs?: number;
    /** Time spent in pre-request setup before the successful attempt */
    requestSetupMs?: number;
    /** Timestamps (Date.now()) of each attempt start — used to emit retry sub-spans */
    attemptStartTimes?: number[];
}): void;
export declare function startToolSpan(toolName: string, toolAttributes?: Record<string, string | number | boolean>, toolInput?: string): Span;
export declare function startToolBlockedOnUserSpan(): Span;
export declare function endToolBlockedOnUserSpan(decision?: string, source?: string): void;
export declare function startToolExecutionSpan(): Span;
export declare function endToolExecutionSpan(metadata?: {
    success?: boolean;
    error?: string;
}): void;
export declare function endToolSpan(toolResult?: string, resultTokens?: number): void;
/**
 * Add a span event with tool content/output data.
 * Only logs if OTEL_LOG_TOOL_CONTENT=1 is set.
 * Truncates content if it exceeds MAX_CONTENT_SIZE.
 */
export declare function addToolContentEvent(eventName: string, attributes: Record<string, string | number | boolean>): void;
export declare function getCurrentSpan(): Span | null;
export declare function executeInSpan<T>(spanName: string, fn: (span: Span) => Promise<T>, attributes?: Record<string, string | number | boolean>): Promise<T>;
/**
 * Start a hook execution span.
 * Only creates a span when beta tracing is enabled.
 * @param hookEvent The hook event type (e.g., 'PreToolUse', 'PostToolUse')
 * @param hookName The full hook name (e.g., 'PreToolUse:Write')
 * @param numHooks The number of hooks being executed
 * @param hookDefinitions JSON string of hook definitions for tracing
 * @returns The span (or a dummy span if tracing is disabled)
 */
export declare function startHookSpan(hookEvent: string, hookName: string, numHooks: number, hookDefinitions: string): Span;
/**
 * End a hook execution span with outcome metadata.
 * Only does work when beta tracing is enabled.
 * @param span The span to end (returned from startHookSpan)
 * @param metadata The outcome metadata for the hook execution
 */
export declare function endHookSpan(span: Span, metadata?: {
    numSuccess?: number;
    numBlocking?: number;
    numNonBlockingError?: number;
    numCancelled?: number;
}): void;
//# sourceMappingURL=sessionTracing.d.ts.map