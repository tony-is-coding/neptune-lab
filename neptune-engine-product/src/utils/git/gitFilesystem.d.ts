/**
 * Filesystem-based git state reading — avoids spawning git subprocesses.
 *
 * Covers: resolving .git directories (including worktrees/submodules),
 * parsing HEAD, resolving refs via loose files and packed-refs,
 * and the GitHeadWatcher that caches branch/SHA with fs.watchFile.
 *
 * Correctness notes (verified against git source):
 *   - HEAD: `ref: refs/heads/<branch>\n` or raw SHA (refs/files-backend.c)
 *   - Packed-refs: `<sha> <refname>\n`, skip `#` and `^` lines (packed-backend.c)
 *   - .git file (worktree): `gitdir: <path>\n` with optional relative path (setup.c)
 *   - Shallow: mere existence of `<commonDir>/shallow` means shallow (shallow.c)
 */
/** Clear cached git dir resolutions. Exported for testing only. */
export declare function clearResolveGitDirCache(): void;
/**
 * Resolve the actual .git directory for a repo.
 * Handles worktrees/submodules where .git is a file containing `gitdir: <path>`.
 * Memoized per startPath.
 */
export declare function resolveGitDir(startPath?: string): Promise<string | null>;
/**
 * Validate that a ref/branch name read from .git/ is safe to use in path
 * joins, as git positional arguments, and when interpolated into shell
 * commands (commit-push-pr skill interpolates the branch into shell).
 * An attacker who controls .git/HEAD or a loose ref file could otherwise
 * embed path traversal (`..`), argument injection (leading `-`), or shell
 * metacharacters — .git/HEAD is a plain text file that can be written
 * without git's own check-ref-format validation.
 *
 * Allowlist: ASCII alphanumerics, `/`, `.`, `_`, `+`, `-`, `@` only. This
 * covers all legitimate git branch names (e.g. `feature/foo`,
 * `release-1.2.3+build`, `dependabot/npm_and_yarn/@types/node-18.0.0`)
 * while rejecting everything that could be dangerous in shell context
 * (newlines, backticks, `$`, `;`, `|`, `&`, `(`, `)`, `<`, `>`, spaces,
 * tabs, quotes, backslash) and path traversal (`..`).
 */
export declare function isSafeRefName(name: string): boolean;
/**
 * Validate that a string is a git SHA: 40 hex chars (SHA-1) or 64 hex chars
 * (SHA-256). Git never writes abbreviated SHAs to HEAD or ref files, so we
 * only accept full-length hashes.
 *
 * An attacker who controls .git/HEAD when detached, or a loose ref file,
 * could otherwise return arbitrary content that flows into shell contexts.
 */
export declare function isValidGitSha(s: string): boolean;
/**
 * Parse .git/HEAD to determine current branch or detached SHA.
 *
 * HEAD format (per git source, refs/files-backend.c):
 *   - `ref: refs/heads/<branch>\n`  — on a branch
 *   - `ref: <other-ref>\n`          — unusual symref (e.g. during bisect)
 *   - `<hex-sha>\n`                 — detached HEAD (e.g. during rebase)
 *
 * Git strips trailing whitespace via strbuf_rtrim; .trim() is equivalent.
 * Git allows any whitespace between "ref:" and the path; we handle
 * this by trimming after slicing past "ref:".
 */
export declare function readGitHead(gitDir: string): Promise<{
    type: 'branch';
    name: string;
} | {
    type: 'detached';
    sha: string;
} | null>;
/**
 * Resolve a git ref (e.g. `refs/heads/main`) to a commit SHA.
 * Checks loose ref files first, then falls back to packed-refs.
 * Follows symrefs (e.g. `ref: refs/remotes/origin/main`).
 *
 * For worktrees, refs live in the common gitdir (pointed to by the
 * `commondir` file), not the worktree-specific gitdir. We check the
 * worktree gitdir first, then fall back to the common dir.
 *
 * Packed-refs format (per packed-backend.c):
 *   - Header: `# pack-refs with: <traits>\n`
 *   - Entries: `<40-hex-sha> <refname>\n`
 *   - Peeled:  `^<40-hex-sha>\n` (after annotated tag entries)
 */
export declare function resolveRef(gitDir: string, ref: string): Promise<string | null>;
/**
 * Read the `commondir` file to find the shared git directory.
 * In a worktree, this points to the main repo's .git dir.
 * Returns null if no commondir file exists (regular repo).
 */
export declare function getCommonDir(gitDir: string): Promise<string | null>;
/**
 * Read a raw symref file and extract the branch name after a known prefix.
 * Returns null if the ref doesn't exist, isn't a symref, or doesn't match the prefix.
 * Checks loose file only — packed-refs doesn't store symrefs.
 */
export declare function readRawSymref(gitDir: string, refPath: string, branchPrefix: string): Promise<string | null>;
export declare function getCachedBranch(): Promise<string>;
export declare function getCachedHead(): Promise<string>;
export declare function getCachedRemoteUrl(): Promise<string | null>;
export declare function getCachedDefaultBranch(): Promise<string>;
/** Reset the git file watcher state. For testing only. */
export declare function resetGitFileWatcher(): void;
/**
 * Read the HEAD SHA for an arbitrary directory (not using the watcher).
 * Used by plugins that need the HEAD of a specific repo, not the CWD repo.
 */
export declare function getHeadForDir(cwd: string): Promise<string | null>;
/**
 * Read the HEAD SHA for a git worktree directory (not the main repo).
 *
 * Unlike `getHeadForDir`, this reads `<worktreePath>/.git` directly as a
 * `gitdir:` pointer file, with no upward walk. `getHeadForDir` walks upward
 * via `findGitRoot` and would find the parent repo's `.git` when the
 * worktree path doesn't exist — misreporting the parent HEAD as the worktree's.
 *
 * Returns null if the worktree doesn't exist (`.git` pointer ENOENT) or is
 * malformed. Caller can treat null as "not a valid worktree".
 */
export declare function readWorktreeHeadSha(worktreePath: string): Promise<string | null>;
/**
 * Read the remote origin URL for an arbitrary directory via .git/config.
 */
export declare function getRemoteUrlForDir(cwd: string): Promise<string | null>;
/**
 * Check if we're in a shallow clone by looking for <commonDir>/shallow.
 * Per git's shallow.c, mere existence of the file means shallow.
 * The shallow file lives in commonDir, not the per-worktree gitDir.
 */
export declare function isShallowClone(): Promise<boolean>;
/**
 * Count worktrees by reading <commonDir>/worktrees/ directory.
 * The worktrees/ directory lives in commonDir, not the per-worktree gitDir.
 * The main worktree is not listed there, so add 1.
 */
export declare function getWorktreeCountFromFs(): Promise<number>;
//# sourceMappingURL=gitFilesystem.d.ts.map