/**
 * Proactive mode — tick-driven autonomous agent.
 *
 * State machine: inactive → active (→ paused → active) → inactive
 *
 * When active, the REPL periodically injects <tick> prompts so the model
 * keeps working even when the user is idle.  SleepTool lets the model
 * control its own wake-up cadence.
 *
 * @cli-only
 */
export declare function isProactiveActive(): boolean;
export declare function activateProactive(source?: string): void;
export declare function deactivateProactive(): void;
export declare function isProactivePaused(): boolean;
export declare function pauseProactive(): void;
export declare function resumeProactive(): void;
/**
 * Block / unblock tick generation.
 *
 * Set to `true` on API errors to prevent tick → error → tick runaway loops.
 * Cleared on successful response or after compaction.
 */
export declare function setContextBlocked(blocked: boolean): void;
export declare function isContextBlocked(): boolean;
/**
 * Schedule the next tick timestamp (epoch ms).
 * Called by useProactive after submitting a tick.
 */
export declare function setNextTickAt(ts: number | null): void;
/**
 * Returns the epoch-ms timestamp of the next scheduled tick, or null.
 * Used by PromptInputFooterLeftSide to render a countdown.
 */
export declare function getNextTickAt(): number | null;
export declare function getActivationSource(): string | undefined;
/**
 * Subscribe to any proactive state change.
 * Returns an unsubscribe function.
 */
export declare function subscribeToProactiveChanges(cb: () => void): () => void;
/**
 * Whether ticks should fire right now.
 * Convenience predicate combining all blocking conditions.
 */
export declare function shouldTick(): boolean;
//# sourceMappingURL=index.d.ts.map