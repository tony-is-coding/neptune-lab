/**
 * Startup profiling utility for measuring and reporting time spent in various
 * initialization phases.
 *
 * Two modes:
 * 1. Sampled logging: 100% of ant users, 0.1% of external users - logs phases to Statsig
 * 2. Detailed profiling: CLAUDE_CODE_PROFILE_STARTUP=1 - full report with memory snapshots
 *
 * Uses Node.js built-in performance hooks API for standard timing measurement.
 */
/**
 * Record a checkpoint with the given name
 */
export declare function profileCheckpoint(name: string): void;
export declare function profileReport(): void;
export declare function isDetailedProfilingEnabled(): boolean;
export declare function getStartupPerfLogPath(): string;
/**
 * Log startup performance phases to Statsig.
 * Only logs if this session was sampled at startup.
 */
export declare function logStartupPerf(): void;
//# sourceMappingURL=startupProfiler.d.ts.map