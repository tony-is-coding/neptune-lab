import type { ToolPermissionContext } from '../../Tool.js';
import type { PermissionDecisionReason } from './PermissionResult.js';
export type FileOperationType = 'read' | 'write' | 'create';
export type PathCheckResult = {
    allowed: boolean;
    decisionReason?: PermissionDecisionReason;
};
export type ResolvedPathCheckResult = PathCheckResult & {
    resolvedPath: string;
};
export declare function formatDirectoryList(directories: string[]): string;
/**
 * Extracts the base directory from a glob pattern for validation.
 * For example: "/path/to/*.txt" returns "/path/to"
 */
export declare function getGlobBaseDirectory(path: string): string;
/**
 * Expands tilde (~) at the start of a path to the user's home directory.
 * Note: ~username expansion is not supported for security reasons.
 */
export declare function expandTilde(path: string): string;
/**
 * Checks if a resolved path is writable according to the sandbox write allowlist.
 * When the sandbox is enabled, the user has explicitly configured which directories
 * are writable. We treat these as additional allowed write directories for path
 * validation purposes, so commands like `echo foo > /tmp/claude/x.txt` don't
 * prompt for permission when /tmp/claude/ is already in the sandbox allowlist.
 *
 * Respects the deny-within-allow list: paths in denyWithinAllow (like
 * .claude/settings.json) are still blocked even if their parent is in allowOnly.
 */
export declare function isPathInSandboxWriteAllowlist(resolvedPath: string): boolean;
/**
 * Checks if a resolved path is allowed for the given operation type.
 *
 * @param precomputedPathsToCheck - Optional cached result of
 *   `getPathsForPermissionCheck(resolvedPath)`. When `resolvedPath` is the
 *   output of `realpathSync` (canonical path, all symlinks resolved), this
 *   is trivially `[resolvedPath]` and passing it here skips 5 redundant
 *   syscalls per inner check. Do NOT pass this for non-canonical paths
 *   (nonexistent files, UNC paths, etc.) — parent-directory symlink
 *   resolution is still required for those.
 */
export declare function isPathAllowed(resolvedPath: string, context: ToolPermissionContext, operationType: FileOperationType, precomputedPathsToCheck?: readonly string[]): PathCheckResult;
/**
 * Validates a glob pattern by checking its base directory.
 * Returns the validation result for the base path where the glob would expand.
 */
export declare function validateGlobPattern(cleanPath: string, cwd: string, toolPermissionContext: ToolPermissionContext, operationType: FileOperationType): ResolvedPathCheckResult;
/**
 * Checks if a resolved path is dangerous for removal operations (rm/rmdir).
 * Dangerous paths are:
 * - Wildcard '*' (removes all files in directory)
 * - Any path ending with '/*' or '\*' (e.g., /path/to/dir/*, C:\foo\*)
 * - Root directory (/)
 * - Home directory (~)
 * - Direct children of root (/usr, /tmp, /etc, etc.)
 * - Windows drive root (C:\, D:\) and direct children (C:\Windows, C:\Users)
 */
export declare function isDangerousRemovalPath(resolvedPath: string): boolean;
/**
 * Validates a file system path, handling tilde expansion and glob patterns.
 * Returns whether the path is allowed and the resolved path for error messages.
 */
export declare function validatePath(path: string, cwd: string, toolPermissionContext: ToolPermissionContext, operationType: FileOperationType): ResolvedPathCheckResult;
//# sourceMappingURL=pathValidation.d.ts.map