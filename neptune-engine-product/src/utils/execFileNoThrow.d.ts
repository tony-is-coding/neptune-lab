export { execSyncWithDefaults_DEPRECATED } from './execFileNoThrowPortable.js';
type ExecFileOptions = {
    abortSignal?: AbortSignal;
    timeout?: number;
    preserveOutputOnError?: boolean;
    useCwd?: boolean;
    env?: NodeJS.ProcessEnv;
    stdin?: 'ignore' | 'inherit' | 'pipe';
    input?: string;
};
export declare function execFileNoThrow(file: string, args: string[], options?: ExecFileOptions): Promise<{
    stdout: string;
    stderr: string;
    code: number;
    error?: string;
}>;
type ExecFileWithCwdOptions = {
    abortSignal?: AbortSignal;
    timeout?: number;
    preserveOutputOnError?: boolean;
    maxBuffer?: number;
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    shell?: boolean | string | undefined;
    stdin?: 'ignore' | 'inherit' | 'pipe';
    input?: string;
};
/**
 * execFile, but always resolves (never throws)
 */
export declare function execFileNoThrowWithCwd(file: string, args: string[], { abortSignal, timeout: finalTimeout, preserveOutputOnError: finalPreserveOutput, cwd: finalCwd, env: finalEnv, maxBuffer, shell, stdin: finalStdin, input: finalInput, }?: ExecFileWithCwdOptions): Promise<{
    stdout: string;
    stderr: string;
    code: number;
    error?: string;
}>;
//# sourceMappingURL=execFileNoThrow.d.ts.map