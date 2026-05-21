/**
 * Portable worktree detection using only child_process — no analytics,
 * no bootstrap deps, no execa. Used by listSessionsImpl.ts (SDK) and
 * anywhere that needs worktree paths without pulling in the CLI
 * dependency chain (execa → cross-spawn → which).
 */
export declare function getWorktreePathsPortable(cwd: string): Promise<string[]>;
//# sourceMappingURL=getWorktreePathsPortable.d.ts.map