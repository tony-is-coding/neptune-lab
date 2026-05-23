/**
 * Session Memory utility functions that can be imported without circular dependencies.
 * These are separate from the main sessionMemory.ts to avoid importing runAgent.
 */
/**
 * Configuration for session memory extraction thresholds
 */
export type SessionMemoryConfig = {
    /** Minimum context window tokens before initializing session memory.
     * Uses the same token counting as autocompact (input + output + cache tokens)
     * to ensure consistent behavior between the two features. */
    minimumMessageTokensToInit: number;
    /** Minimum context window growth (in tokens) between session memory updates.
     * Uses the same token counting as autocompact (tokenCountWithEstimation)
     * to measure actual context growth, not cumulative API usage. */
    minimumTokensBetweenUpdate: number;
    /** Number of tool calls between session memory updates */
    toolCallsBetweenUpdates: number;
};
export declare const DEFAULT_SESSION_MEMORY_CONFIG: SessionMemoryConfig;
/**
 * Get the message ID up to which the session memory is current
 */
export declare function getLastSummarizedMessageId(): string | undefined;
/**
 * Set the last summarized message ID (called from sessionMemory.ts)
 */
export declare function setLastSummarizedMessageId(messageId: string | undefined): void;
/**
 * Mark extraction as started (called from sessionMemory.ts)
 */
export declare function markExtractionStarted(): void;
/**
 * Mark extraction as completed (called from sessionMemory.ts)
 */
export declare function markExtractionCompleted(): void;
/**
 * Wait for any in-progress session memory extraction to complete (with 15s timeout)
 * Returns immediately if no extraction is in progress or if extraction is stale (>1min old).
 */
export declare function waitForSessionMemoryExtraction(): Promise<void>;
/**
 * Get the current session memory content
 */
export declare function getSessionMemoryContent(): Promise<string | null>;
/**
 * Set the session memory configuration
 */
export declare function setSessionMemoryConfig(config: Partial<SessionMemoryConfig>): void;
/**
 * Get the current session memory configuration
 */
export declare function getSessionMemoryConfig(): SessionMemoryConfig;
/**
 * Record the context size at the time of extraction.
 * Used to measure context growth for minimumTokensBetweenUpdate threshold.
 */
export declare function recordExtractionTokenCount(currentTokenCount: number): void;
/**
 * Check if session memory has been initialized (met minimumTokensToInit threshold)
 */
export declare function isSessionMemoryInitialized(): boolean;
/**
 * Mark session memory as initialized
 */
export declare function markSessionMemoryInitialized(): void;
/**
 * Check if we've met the threshold to initialize session memory.
 * Uses total context window tokens (same as autocompact) for consistent behavior.
 */
export declare function hasMetInitializationThreshold(currentTokenCount: number): boolean;
/**
 * Check if we've met the threshold for the next update.
 * Measures actual context window growth since last extraction
 * (same metric as autocompact and initialization threshold).
 */
export declare function hasMetUpdateThreshold(currentTokenCount: number): boolean;
/**
 * Get the configured number of tool calls between updates
 */
export declare function getToolCallsBetweenUpdates(): number;
/**
 * Reset session memory state (useful for testing)
 */
export declare function resetSessionMemoryState(): void;
//# sourceMappingURL=sessionMemoryUtils.d.ts.map