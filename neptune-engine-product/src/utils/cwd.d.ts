/**
 * Run a function with an overridden working directory for the current async context.
 * All calls to pwd()/getCwd() within the function (and its async descendants) will
 * return the overridden cwd instead of the global one. This enables concurrent
 * agents to each see their own working directory without affecting each other.
 */
export declare function runWithCwdOverride<T>(cwd: string, fn: () => T): T;
/**
 * Get the current working directory
 */
export declare function pwd(): string;
/**
 * Get the current working directory or the original working directory if the current one is not available
 */
export declare function getCwd(): string;
//# sourceMappingURL=cwd.d.ts.map