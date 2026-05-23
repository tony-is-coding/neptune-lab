/**
 * Disk cap for task output files. In file mode (bash), a watchdog polls
 * file size and kills the process. In pipe mode (hooks), DiskTaskOutput
 * drops chunks past this limit. Shared so both caps stay in sync.
 */
export declare const MAX_TASK_OUTPUT_BYTES: number;
export declare const MAX_TASK_OUTPUT_BYTES_DISPLAY = "5GB";
export declare function getTaskOutputDir(): string;
/** Test helper — clears the memoized dir. */
export declare function _resetTaskOutputDirForTest(): void;
/**
 * Get the output file path for a task
 */
export declare function getTaskOutputPath(taskId: string): string;
/**
 * Encapsulates async disk writes for a single task's output.
 *
 * Uses a flat array as a write queue processed by a single drain loop,
 * so each chunk can be GC'd immediately after its write completes.
 * This avoids the memory retention problem of chained .then() closures
 * where every reaction captures its data until the whole chain resolves.
 */
export declare class DiskTaskOutput {
    #private;
    constructor(taskId: string);
    append(content: string): void;
    flush(): Promise<void>;
    cancel(): void;
}
/**
 * Test helper — cancel pending writes, await in-flight ops, clear the map.
 * backgroundShells.test.ts and other task tests spawn real shells that
 * write through this module without afterEach cleanup; their entries
 * leak into diskOutput.test.ts on the same shard.
 *
 * Awaits all tracked promises until the set stabilizes — a settling promise
 * may spawn another (initTaskOutputAsSymlink's catch → initTaskOutput).
 * Call this in afterEach BEFORE rmSync to avoid async-ENOENT-after-teardown.
 */
export declare function _clearOutputsForTest(): Promise<void>;
/**
 * Append output to a task's disk file asynchronously.
 * Creates the file if it doesn't exist.
 */
export declare function appendTaskOutput(taskId: string, content: string): void;
/**
 * Wait for all pending writes for a task to complete.
 * Useful before reading output to ensure all data is flushed.
 */
export declare function flushTaskOutput(taskId: string): Promise<void>;
/**
 * Evict a task's DiskTaskOutput from the in-memory map after flushing.
 * Unlike cleanupTaskOutput, this does not delete the output file on disk.
 * Call this when a task completes and its output has been consumed.
 */
export declare function evictTaskOutput(taskId: string): Promise<void>;
/**
 * Get delta (new content) since last read.
 * Reads only from the byte offset, up to maxBytes — never loads the full file.
 */
export declare function getTaskOutputDelta(taskId: string, fromOffset: number, maxBytes?: number): Promise<{
    content: string;
    newOffset: number;
}>;
/**
 * Get output for a task, reading the tail of the file.
 * Caps at maxBytes to avoid loading multi-GB files into memory.
 */
export declare function getTaskOutput(taskId: string, maxBytes?: number): Promise<string>;
/**
 * Get the current size (offset) of a task's output file.
 */
export declare function getTaskOutputSize(taskId: string): Promise<number>;
/**
 * Clean up a task's output file and write queue.
 */
export declare function cleanupTaskOutput(taskId: string): Promise<void>;
/**
 * Initialize output file for a new task.
 * Creates an empty file to ensure the path exists.
 */
export declare function initTaskOutput(taskId: string): Promise<string>;
/**
 * Initialize output file as a symlink to another file (e.g., agent transcript).
 * Tries to create the symlink first; if a file already exists, removes it and retries.
 */
export declare function initTaskOutputAsSymlink(taskId: string, targetPath: string): Promise<string>;
//# sourceMappingURL=diskOutput.d.ts.map