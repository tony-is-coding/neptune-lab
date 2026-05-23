/**
 * Standalone implementation of listSessions for the Agent SDK.
 *
 * Dependencies are kept minimal and portable — no bootstrap/state.ts,
 * no analytics, no bun:bundle, no module-scope mutable state. This module
 * can be imported safely from the SDK entrypoint without triggering CLI
 * initialization or pulling in expensive dependency chains.
 */
import type { LiteSessionFile } from './sessionStoragePortable.js';
/**
 * Session metadata returned by listSessions.
 * Contains only data extractable from stat + head/tail reads — no full
 * JSONL parsing required.
 */
export type SessionInfo = {
    sessionId: string;
    summary: string;
    lastModified: number;
    fileSize?: number;
    customTitle?: string;
    firstPrompt?: string;
    gitBranch?: string;
    cwd?: string;
    tag?: string;
    /** Epoch ms — from first entry's ISO timestamp. Undefined if unparseable. */
    createdAt?: number;
};
export type ListSessionsOptions = {
    /**
     * Directory to list sessions for. When provided, returns sessions for
     * this project directory (and optionally its git worktrees). When omitted,
     * returns sessions across all projects.
     */
    dir?: string;
    /** Maximum number of sessions to return. */
    limit?: number;
    /**
     * Number of sessions to skip from the start of the sorted result set.
     * Use with `limit` for pagination. Defaults to 0.
     */
    offset?: number;
    /**
     * When `dir` is provided and the directory is inside a git repository,
     * include sessions from all git worktree paths. Defaults to `true`.
     */
    includeWorktrees?: boolean;
};
/**
 * Parses SessionInfo fields from a lite session read (head/tail/stat).
 * Returns null for sidechain sessions or metadata-only sessions with no
 * extractable summary.
 *
 * Exported for reuse by getSessionInfoImpl.
 */
export declare function parseSessionInfoFromLite(sessionId: string, lite: LiteSessionFile, projectPath?: string): SessionInfo | null;
type Candidate = {
    sessionId: string;
    filePath: string;
    mtime: number;
    /** Project path for cwd fallback when file lacks a cwd field. */
    projectPath?: string;
};
/**
 * Lists candidate session files in a directory via readdir, optionally
 * stat'ing each for mtime. When `doStat` is false, mtime is set to 0
 * (caller must sort/dedup after reading file contents instead).
 */
export declare function listCandidates(projectDir: string, doStat: boolean, projectPath?: string): Promise<Candidate[]>;
/**
 * Lists sessions with metadata extracted from stat + head/tail reads.
 *
 * When `dir` is provided, returns sessions for that project directory
 * and its git worktrees. When omitted, returns sessions across all
 * projects.
 *
 * Pagination via `limit`/`offset` operates on the filtered, sorted result
 * set. When either is set, a cheap stat-only pass sorts candidates before
 * expensive head/tail reads — so `limit: 20` on a directory with 1000
 * sessions does ~1000 stats + ~20 content reads, not 1000 content reads.
 * When neither is set, stat is skipped (read-all-then-sort, same I/O cost
 * as the original implementation).
 */
export declare function listSessionsImpl(options?: ListSessionsOptions): Promise<SessionInfo[]>;
export {};
//# sourceMappingURL=listSessionsImpl.d.ts.map