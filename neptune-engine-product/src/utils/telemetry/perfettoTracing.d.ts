/**
 * Perfetto Tracing for Claude Code (Ant-only)
 *
 * This module generates traces in the Chrome Trace Event format that can be
 * viewed in ui.perfetto.dev or Chrome's chrome://tracing.
 *
 * NOTE: This feature is ant-only and eliminated from external builds.
 *
 * The trace file includes:
 * - Agent hierarchy (parent-child relationships in a swarm)
 * - API requests with TTFT, TTLT, prompt length, cache stats, msg ID, speculative flag
 * - Tool executions with name, duration, and token usage
 * - User input waiting time
 *
 * Usage:
 * 1. Enable via CLAUDE_CODE_PERFETTO_TRACE=1 or CLAUDE_CODE_PERFETTO_TRACE=<path>
 * 2. Optionally set CLAUDE_CODE_PERFETTO_WRITE_INTERVAL_S=<positive integer> to write the
 *    trace file periodically (default: write only on exit).
 * 3. Run Claude Code normally
 * 4. Trace file is written to ~/.claude/traces/trace-<session-id>.json
 *    or to the specified path
 * 5. Open in ui.perfetto.dev to visualize
 */
/**
 * Chrome Trace Event format types
 * See: https://docs.google.com/document/d/1CvAClvFfyA5R-PhYUmn5OOQtYMH4h6I0nSsKchNAySU
 */
export type TraceEventPhase = 'B' | 'E' | 'X' | 'i' | 'C' | 'b' | 'n' | 'e' | 'M';
export type TraceEvent = {
    name: string;
    cat: string;
    ph: TraceEventPhase;
    ts: number;
    pid: number;
    tid: number;
    dur?: number;
    args?: Record<string, unknown>;
    id?: string;
    scope?: string;
};
/**
 * Initialize Perfetto tracing
 * Call this early in the application lifecycle
 */
export declare function initializePerfettoTracing(): void;
/**
 * Check if Perfetto tracing is enabled
 */
export declare function isPerfettoTracingEnabled(): boolean;
/**
 * Register a new agent in the trace
 * Call this when a subagent/teammate is spawned
 */
export declare function registerAgent(agentId: string, agentName: string, parentAgentId?: string): void;
/**
 * Unregister an agent from the trace.
 * Call this when an agent completes, fails, or is aborted to free memory.
 */
export declare function unregisterAgent(agentId: string): void;
/**
 * Start an API call span
 */
export declare function startLLMRequestPerfettoSpan(args: {
    model: string;
    promptTokens?: number;
    messageId?: string;
    isSpeculative?: boolean;
    querySource?: string;
}): string;
/**
 * End an API call span with response metadata
 */
export declare function endLLMRequestPerfettoSpan(spanId: string, metadata: {
    ttftMs?: number;
    ttltMs?: number;
    promptTokens?: number;
    outputTokens?: number;
    cacheReadTokens?: number;
    cacheCreationTokens?: number;
    messageId?: string;
    success?: boolean;
    error?: string;
    /** Time spent in pre-request setup (client creation, retries) before the successful attempt */
    requestSetupMs?: number;
    /** Timestamps (Date.now()) of each attempt start — used to emit retry sub-spans */
    attemptStartTimes?: number[];
}): void;
/**
 * Start a tool execution span
 */
export declare function startToolPerfettoSpan(toolName: string, args?: Record<string, unknown>): string;
/**
 * End a tool execution span
 */
export declare function endToolPerfettoSpan(spanId: string, metadata?: {
    success?: boolean;
    error?: string;
    resultTokens?: number;
}): void;
/**
 * Start a user input waiting span
 */
export declare function startUserInputPerfettoSpan(context?: string): string;
/**
 * End a user input waiting span
 */
export declare function endUserInputPerfettoSpan(spanId: string, metadata?: {
    decision?: string;
    source?: string;
}): void;
/**
 * Emit an instant event (marker)
 */
export declare function emitPerfettoInstant(name: string, category: string, args?: Record<string, unknown>): void;
/**
 * Emit a counter event for tracking metrics over time
 */
export declare function emitPerfettoCounter(name: string, values: Record<string, number>): void;
/**
 * Start an interaction span (wraps a full user request cycle)
 */
export declare function startInteractionPerfettoSpan(userPrompt?: string): string;
/**
 * End an interaction span
 */
export declare function endInteractionPerfettoSpan(spanId: string): void;
/**
 * Get all recorded events (for testing)
 */
export declare function getPerfettoEvents(): TraceEvent[];
/**
 * Reset the tracer state (for testing)
 */
export declare function resetPerfettoTracer(): void;
/**
 * Trigger a periodic write immediately (for testing)
 */
export declare function triggerPeriodicWriteForTesting(): Promise<void>;
/**
 * Evict stale spans immediately (for testing)
 */
export declare function evictStaleSpansForTesting(): void;
export declare const MAX_EVENTS_FOR_TESTING = 100000;
export declare function evictOldestEventsForTesting(): void;
//# sourceMappingURL=perfettoTracing.d.ts.map