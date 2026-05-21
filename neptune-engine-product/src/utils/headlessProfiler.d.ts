/**
 * Headless mode profiling utility for measuring per-turn latency in -p (print) mode.
 *
 * Tracks key timing phases per turn:
 * - Time to system message output (turn 0 only)
 * - Time to first query started
 * - Time to first API response (TTFT)
 *
 * Uses Node.js built-in performance hooks API for standard timing measurement.
 * Sampled logging: 100% of ant users, 5% of external users.
 *
 * Set CLAUDE_CODE_PROFILE_STARTUP=1 for detailed logging output.
 */
/**
 * Start a new turn for profiling. Clears previous marks, increments turn number,
 * and records turn_start. Call this at the beginning of each user message processing.
 */
export declare function headlessProfilerStartTurn(): void;
/**
 * Record a checkpoint with the given name.
 * Only records if in headless mode and profiling is enabled.
 */
export declare function headlessProfilerCheckpoint(name: string): void;
/**
 * Log headless latency metrics for the current turn to Statsig.
 * Call this at the end of each turn (before processing next user message).
 */
export declare function logHeadlessProfilerTurn(): void;
//# sourceMappingURL=headlessProfiler.d.ts.map