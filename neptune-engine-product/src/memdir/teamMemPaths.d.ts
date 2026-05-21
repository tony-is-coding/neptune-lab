/**
 * Error thrown when a path validation detects a traversal or injection attempt.
 */
export declare class PathTraversalError extends Error {
    constructor(message: string);
}
/**
 * Whether team memory features are enabled.
 * Team memory is a subdirectory of auto memory, so it requires auto memory
 * to be enabled. This keeps all team-memory consumers (prompt, content
 * injection, sync watcher, file detection) consistent when auto memory is
 * disabled via env var or settings.
 */
export declare function isTeamMemoryEnabled(): boolean;
/**
 * Returns the team memory path: <memoryBase>/projects/<sanitized-project-root>/memory/team/
 * Lives as a subdirectory of the auto-memory directory, scoped per-project.
 */
export declare function getTeamMemPath(): string;
/**
 * Returns the team memory entrypoint: <memoryBase>/projects/<sanitized-project-root>/memory/team/MEMORY.md
 * Lives as a subdirectory of the auto-memory directory, scoped per-project.
 */
export declare function getTeamMemEntrypoint(): string;
/**
 * Check if a resolved absolute path is within the team memory directory.
 * Uses path.resolve() to convert relative paths and eliminate traversal segments.
 * Does NOT resolve symlinks — for write validation use validateTeamMemWritePath()
 * or validateTeamMemKey() which include symlink resolution.
 */
export declare function isTeamMemPath(filePath: string): boolean;
/**
 * Validate that an absolute file path is safe for writing to the team memory directory.
 * Returns the resolved absolute path if valid.
 * Throws PathTraversalError if the path contains injection vectors, escapes the
 * directory via .. segments, or escapes via a symlink (PSR M22186).
 */
export declare function validateTeamMemWritePath(filePath: string): Promise<string>;
/**
 * Validate a relative path key from the server against the team memory directory.
 * Sanitizes the key, joins with the team dir, resolves symlinks on the deepest
 * existing ancestor, and verifies containment against the real team dir.
 * Returns the resolved absolute path.
 * Throws PathTraversalError if the key is malicious (PSR M22186).
 */
export declare function validateTeamMemKey(relativeKey: string): Promise<string>;
/**
 * Check if a file path is within the team memory directory
 * and team memory is enabled.
 */
export declare function isTeamMemFile(filePath: string): boolean;
//# sourceMappingURL=teamMemPaths.d.ts.map