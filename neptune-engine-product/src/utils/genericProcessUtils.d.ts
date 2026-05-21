/**
 * Check if a process with the given PID is running (signal 0 probe).
 *
 * PID ≤ 1 returns false (0 is current process group, 1 is init).
 *
 * Note: `process.kill(pid, 0)` throws EPERM when the process exists but is
 * owned by another user. This reports such processes as NOT running, which
 * is conservative for lock recovery (we won't steal a live lock).
 */
export declare function isProcessRunning(pid: number): boolean;
/**
 * Gets the ancestor process chain for a given process (up to maxDepth levels)
 * @param pid - The starting process ID
 * @param maxDepth - Maximum number of ancestors to fetch (default: 10)
 * @returns Array of ancestor PIDs from immediate parent to furthest ancestor
 */
export declare function getAncestorPidsAsync(pid: string | number, maxDepth?: number): Promise<number[]>;
/**
 * Gets the command line for a given process
 * @param pid - The process ID to get the command for
 * @returns The command line string, or null if not found
 * @deprecated Use getAncestorCommandsAsync instead
 */
export declare function getProcessCommand(pid: string | number): string | null;
/**
 * Gets the command lines for a process and its ancestors in a single call
 * @param pid - The starting process ID
 * @param maxDepth - Maximum depth to traverse (default: 10)
 * @returns Array of command strings for the process chain
 */
export declare function getAncestorCommandsAsync(pid: string | number, maxDepth?: number): Promise<string[]>;
/**
 * Gets the child process IDs for a given process
 * @param pid - The parent process ID
 * @returns Array of child process IDs as numbers
 */
export declare function getChildPids(pid: string | number): number[];
//# sourceMappingURL=genericProcessUtils.d.ts.map