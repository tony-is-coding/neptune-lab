type ProgressCallback = (lastLines: string, allLines: string, totalLines: number, totalBytes: number, isIncomplete: boolean) => void;
/**
 * Single source of truth for a shell command's output.
 *
 * For bash commands (file mode): both stdout and stderr go directly to
 * a file via stdio fds — neither enters JS. Progress is extracted by
 * polling the file tail. getStderr() returns '' since stderr is
 * interleaved in the output file.
 *
 * For hooks (pipe mode): data flows through writeStdout()/writeStderr()
 * and is buffered in memory, spilling to disk if it exceeds the limit.
 */
export declare class TaskOutput {
    #private;
    readonly taskId: string;
    readonly path: string;
    /** True when stdout goes to a file fd (bypassing JS). False for pipe mode (hooks). */
    readonly stdoutToFile: boolean;
    constructor(taskId: string, onProgress: ProgressCallback | null, stdoutToFile?: boolean, maxMemory?: number);
    /**
     * Begin polling the output file for progress. Called from React
     * useEffect when the progress component mounts.
     */
    static startPolling(taskId: string): void;
    /**
     * Stop polling the output file. Called from React useEffect cleanup
     * when the progress component unmounts.
     */
    static stopPolling(taskId: string): void;
    /** Write stdout data (pipe mode only — used by hooks). */
    writeStdout(data: string): void;
    /** Write stderr data (always piped). */
    writeStderr(data: string): void;
    /**
     * Get stdout. In file mode, reads from the output file.
     * In pipe mode, returns the in-memory buffer or tail from CircularBuffer.
     */
    getStdout(): Promise<string>;
    /** Sync getter for ExecResult.stderr */
    getStderr(): string;
    get isOverflowed(): boolean;
    get totalLines(): number;
    get totalBytes(): number;
    /**
     * True after getStdout() when the output file was fully read.
     * The file content is redundant (fully in ExecResult.stdout) and can be deleted.
     */
    get outputFileRedundant(): boolean;
    /** Total file size in bytes, set after getStdout() reads the file. */
    get outputFileSize(): number;
    /** Force all buffered content to disk. Call when backgrounding. */
    spillToDisk(): void;
    flush(): Promise<void>;
    /** Delete the output file (fire-and-forget safe). */
    deleteOutputFile(): Promise<void>;
    clear(): void;
}
export {};
//# sourceMappingURL=TaskOutput.d.ts.map