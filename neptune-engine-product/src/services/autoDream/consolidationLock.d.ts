/**
 * mtime of the lock file = lastConsolidatedAt. 0 if absent.
 * Per-turn cost: one stat.
 */
export declare function readLastConsolidatedAt(): Promise<number>;
/**
 * Acquire: write PID → mtime = now. Returns the pre-acquire mtime
 * (for rollback), or null if blocked / lost a race.
 *
 *   Success → do nothing. mtime stays at now.
 *   Failure → rollbackConsolidationLock(priorMtime) rewinds mtime.
 *   Crash   → mtime stuck, dead PID → next process reclaims.
 */
export declare function tryAcquireConsolidationLock(): Promise<number | null>;
/**
 * Rewind mtime to pre-acquire after a failed fork. Clears the PID body —
 * otherwise our still-running process would look like it's holding.
 * priorMtime 0 → unlink (restore no-file).
 */
export declare function rollbackConsolidationLock(priorMtime: number): Promise<void>;
/**
 * Session IDs with mtime after sinceMs. listCandidates handles UUID
 * validation (excludes agent-*.jsonl) and parallel stat.
 *
 * Uses mtime (sessions TOUCHED since), not birthtime (0 on ext4).
 * Caller excludes the current session. Scans per-cwd transcripts — it's
 * a skip-gate, so undercounting worktree sessions is safe.
 */
export declare function listSessionsTouchedSince(sinceMs: number): Promise<string[]>;
/**
 * Stamp from manual /dream. Optimistic — fires at prompt-build time,
 * no post-skill completion hook. Best-effort.
 */
export declare function recordConsolidation(): Promise<void>;
//# sourceMappingURL=consolidationLock.d.ts.map