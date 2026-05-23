/**
 * Returns the paths of all worktrees for the current git repository.
 * If git is not available, not in a git repo, or only has one worktree,
 * returns an empty array.
 *
 * This version includes analytics tracking and uses the CLI's gitExe()
 * resolver. For a portable version without CLI deps, use
 * getWorktreePathsPortable().
 *
 * @param cwd Directory to run the command from
 * @returns Array of absolute worktree paths
 */
export declare function getWorktreePaths(cwd: string): Promise<string[]>;
//# sourceMappingURL=getWorktreePaths.d.ts.map