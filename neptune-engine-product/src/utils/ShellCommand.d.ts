import type { ChildProcess } from 'child_process';
import { TaskOutput } from './task/TaskOutput.js';
export type ExecResult = {
    stdout: string;
    stderr: string;
    code: number;
    interrupted: boolean;
    backgroundTaskId?: string;
    backgroundedByUser?: boolean;
    /** Set when assistant-mode auto-backgrounded a long-running blocking command. */
    assistantAutoBackgrounded?: boolean;
    /** Set when stdout was too large to fit inline — points to the output file on disk. */
    outputFilePath?: string;
    /** Total size of the output file in bytes (set when outputFilePath is set). */
    outputFileSize?: number;
    /** The task ID for the output file (set when outputFilePath is set). */
    outputTaskId?: string;
    /** Error message when the command failed before spawning (e.g., deleted cwd). */
    preSpawnError?: string;
};
export type ShellCommand = {
    background: (backgroundTaskId: string) => boolean;
    result: Promise<ExecResult>;
    kill: () => void;
    status: 'running' | 'backgrounded' | 'completed' | 'killed';
    /**
     * Cleans up stream resources (event listeners).
     * Should be called after the command completes or is killed to prevent memory leaks.
     */
    cleanup: () => void;
    onTimeout?: (callback: (backgroundFn: (taskId: string) => boolean) => void) => void;
    /** The TaskOutput instance that owns all stdout/stderr data and progress. */
    taskOutput: TaskOutput;
};
/**
 * Wraps a child process to enable flexible handling of shell command execution.
 */
export declare function wrapSpawn(childProcess: ChildProcess, abortSignal: AbortSignal, timeout: number, taskOutput: TaskOutput, shouldAutoBackground?: boolean, maxOutputBytes?: number): ShellCommand;
export declare function createAbortedCommand(backgroundTaskId?: string, opts?: {
    stderr?: string;
    code?: number;
}): ShellCommand;
export declare function createFailedCommand(preSpawnError: string): ShellCommand;
//# sourceMappingURL=ShellCommand.d.ts.map