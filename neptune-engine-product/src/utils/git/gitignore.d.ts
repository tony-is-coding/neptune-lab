/**
 * Checks if a path is ignored by git (via `git check-ignore`).
 *
 * This consults all applicable gitignore sources: repo `.gitignore` files
 * (nested), `.git/info/exclude`, and the global gitignore — with correct
 * precedence, because git itself resolves it.
 *
 * Exit codes: 0 = ignored, 1 = not ignored, 128 = not in a git repo.
 * Returns `false` for 128, so callers outside a git repo fail open.
 *
 * @param filePath The path to check (absolute or relative to cwd)
 * @param cwd The working directory to run git from
 */
export declare function isPathGitignored(filePath: string, cwd: string): Promise<boolean>;
/**
 * Gets the path to the global gitignore file (.config/git/ignore)
 * @returns The path to the global gitignore file
 */
export declare function getGlobalGitignorePath(): string;
/**
 * Adds a file pattern to the global gitignore file (.config/git/ignore)
 * if it's not already ignored by existing patterns in any gitignore file
 * @param filename The filename to add to gitignore
 * @param cwd The current working directory (optional)
 */
export declare function addFileGlobRuleToGitignore(filename: string, cwd?: string): Promise<void>;
//# sourceMappingURL=gitignore.d.ts.map