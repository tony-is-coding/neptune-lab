/**
 * Validates a worktree slug to prevent path traversal and directory escape.
 *
 * The slug is joined into `.claude/worktrees/<slug>` via path.join, which
 * normalizes `..` segments — so `../../../target` would escape the worktrees
 * directory. Similarly, an absolute path (leading `/` or `C:\`) would discard
 * the prefix entirely.
 *
 * Forward slashes are allowed for nesting (e.g. `asm/feature-foo`); each
 * segment is validated independently against the allowlist, so `.` / `..`
 * segments and drive-spec characters are still rejected.
 *
 * Throws synchronously — callers rely on this running before any side effects
 * (git commands, hook execution, chdir).
 */
export declare function validateWorktreeSlug(slug: string): void;
export type WorktreeSession = {
    originalCwd: string;
    worktreePath: string;
    worktreeName: string;
    worktreeBranch?: string;
    originalBranch?: string;
    originalHeadCommit?: string;
    sessionId: string;
    tmuxSessionName?: string;
    hookBased?: boolean;
    /** How long worktree creation took (unset when resuming an existing worktree). */
    creationDurationMs?: number;
    /** True if git sparse-checkout was applied via settings.worktree.sparsePaths. */
    usedSparsePaths?: boolean;
};
export declare function getCurrentWorktreeSession(): WorktreeSession | null;
/**
 * Restore the worktree session on --resume. The caller must have already
 * verified the directory exists (via process.chdir) and set the bootstrap
 * state (cwd, originalCwd).
 */
export declare function restoreWorktreeSession(session: WorktreeSession | null): void;
export declare function generateTmuxSessionName(repoPath: string, branch: string): string;
export declare function worktreeBranchName(slug: string): string;
/**
 * Copy gitignored files specified in .worktreeinclude from base repo to worktree.
 *
 * Only copies files that are BOTH:
 * 1. Matched by patterns in .worktreeinclude (uses .gitignore syntax)
 * 2. Gitignored (not tracked by git)
 *
 * Uses `git ls-files --others --ignored --exclude-standard --directory` to list
 * gitignored entries with fully-ignored dirs collapsed to single entries (so large
 * build outputs like node_modules/ don't force a full tree walk), then filters
 * against .worktreeinclude patterns in-process using the `ignore` library. If a
 * .worktreeinclude pattern explicitly targets a path inside a collapsed directory,
 * that directory is expanded with a second scoped `ls-files` call.
 */
export declare function copyWorktreeIncludeFiles(repoRoot: string, worktreePath: string): Promise<string[]>;
/**
 * Parses a PR reference from a string.
 * Accepts GitHub-style PR URLs (e.g., https://github.com/owner/repo/pull/123,
 * or GHE equivalents like https://ghe.example.com/owner/repo/pull/123)
 * or `#N` format (e.g., #123).
 * Returns the PR number or null if the string is not a recognized PR reference.
 */
export declare function parsePRReference(input: string): number | null;
export declare function isTmuxAvailable(): Promise<boolean>;
export declare function getTmuxInstallInstructions(): string;
export declare function createTmuxSessionForWorktree(sessionName: string, worktreePath: string): Promise<{
    created: boolean;
    error?: string;
}>;
export declare function killTmuxSession(sessionName: string): Promise<boolean>;
export declare function createWorktreeForSession(sessionId: string, slug: string, tmuxSessionName?: string, options?: {
    prNumber?: number;
}): Promise<WorktreeSession>;
export declare function keepWorktree(): Promise<void>;
export declare function cleanupWorktree(): Promise<void>;
/**
 * Create a lightweight worktree for a subagent.
 * Reuses getOrCreateWorktree/performPostCreationSetup but does NOT touch
 * global session state (currentWorktreeSession, process.chdir, project config).
 * Falls back to hook-based creation if not in a git repository.
 */
export declare function createAgentWorktree(slug: string): Promise<{
    worktreePath: string;
    worktreeBranch?: string;
    headCommit?: string;
    gitRoot?: string;
    hookBased?: boolean;
}>;
/**
 * Remove a worktree created by createAgentWorktree.
 * For git-based worktrees, removes the worktree directory and deletes the temporary branch.
 * For hook-based worktrees, delegates to the WorktreeRemove hook.
 * Must be called with the main repo's git root (for git worktrees), not the worktree path,
 * since the worktree directory is deleted during this operation.
 */
export declare function removeAgentWorktree(worktreePath: string, worktreeBranch?: string, gitRoot?: string, hookBased?: boolean): Promise<boolean>;
/**
 * Remove stale agent/workflow worktrees older than cutoffDate.
 *
 * Safety:
 * - Only touches slugs matching ephemeral patterns (never user-named worktrees)
 * - Skips the current session's worktree
 * - Fail-closed: skips if git status fails or shows tracked changes
 *   (-uno: untracked files in a 30-day-old crashed agent worktree are build
 *   artifacts; skipping the untracked scan is 5-10× faster on large repos)
 * - Fail-closed: skips if any commits aren't reachable from a remote
 *
 * `git worktree remove --force` handles both the directory and git's internal
 * worktree tracking. If git doesn't recognize the path as a worktree (orphaned
 * dir), it's left in place — a later readdir finding it stale again is harmless.
 */
export declare function cleanupStaleAgentWorktrees(cutoffDate: Date): Promise<number>;
/**
 * Check whether a worktree has uncommitted changes or new commits since creation.
 * Returns true if there are uncommitted changes (dirty working tree), if commits
 * were made on the worktree branch since `headCommit`, or if git commands fail
 * — callers use this to decide whether to remove a worktree, so fail-closed.
 */
export declare function hasWorktreeChanges(worktreePath: string, headCommit: string): Promise<boolean>;
/**
 * Fast-path handler for --worktree --tmux.
 * Creates the worktree and execs into tmux running Claude inside.
 * This is called early in cli.tsx before loading the full CLI.
 */
export declare function execIntoTmuxWorktree(args: string[]): Promise<{
    handled: boolean;
    error?: string;
}>;
//# sourceMappingURL=worktree.d.ts.map