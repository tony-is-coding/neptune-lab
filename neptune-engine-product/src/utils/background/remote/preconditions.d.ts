/**
 * Checks if user needs to log in with Claude.ai
 * Extracted from getTeleportErrors() in TeleportError.tsx
 * @returns true if login is required, false otherwise
 */
export declare function checkNeedsClaudeAiLogin(): Promise<boolean>;
/**
 * Checks if git working directory is clean (no uncommitted changes)
 * Ignores untracked files since they won't be lost during branch switching
 * Extracted from getTeleportErrors() in TeleportError.tsx
 * @returns true if git is clean, false otherwise
 */
export declare function checkIsGitClean(): Promise<boolean>;
/**
 * Checks if user has access to at least one remote environment
 * @returns true if user has remote environments, false otherwise
 */
export declare function checkHasRemoteEnvironment(): Promise<boolean>;
/**
 * Checks if current directory is inside a git repository (has .git/).
 * Distinct from checkHasGitRemote — a local-only repo passes this but not that.
 */
export declare function checkIsInGitRepo(): boolean;
/**
 * Checks if current repository has a GitHub remote configured.
 * Returns false for local-only repos (git init with no `origin`).
 */
export declare function checkHasGitRemote(): Promise<boolean>;
/**
 * Checks if GitHub app is installed on a specific repository
 * @param owner The repository owner (e.g., "anthropics")
 * @param repo The repository name (e.g., "claude-cli-internal")
 * @returns true if GitHub app is installed, false otherwise
 */
export declare function checkGithubAppInstalled(owner: string, repo: string, signal?: AbortSignal): Promise<boolean>;
/**
 * Checks if the user has synced their GitHub credentials via /web-setup
 * @returns true if GitHub token is synced, false otherwise
 */
export declare function checkGithubTokenSynced(): Promise<boolean>;
type RepoAccessMethod = 'github-app' | 'token-sync' | 'none';
/**
 * Tiered check for whether a GitHub repo is accessible for remote operations.
 * 1. GitHub App installed on the repo
 * 2. GitHub token synced via /web-setup
 * 3. Neither — caller should prompt user to set up access
 */
export declare function checkRepoForRemoteAccess(owner: string, repo: string): Promise<{
    hasAccess: boolean;
    method: RepoAccessMethod;
}>;
export {};
//# sourceMappingURL=preconditions.d.ts.map