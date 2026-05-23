import { type Options as ExecaOptions } from 'execa';
type ExecSyncOptions = {
    abortSignal?: AbortSignal;
    timeout?: number;
    input?: string;
    stdio?: ExecaOptions['stdio'];
};
/**
 * @deprecated Use `execa` directly with `{ shell: true, reject: false }` for non-blocking execution.
 * Sync exec calls block the event loop and cause performance issues.
 */
export declare function execSyncWithDefaults_DEPRECATED(command: string): string | null;
/**
 * @deprecated Use `execa` directly with `{ shell: true, reject: false }` for non-blocking execution.
 * Sync exec calls block the event loop and cause performance issues.
 */
export declare function execSyncWithDefaults_DEPRECATED(command: string, options: ExecSyncOptions): string | null;
/**
 * @deprecated Use `execa` directly with `{ shell: true, reject: false }` for non-blocking execution.
 * Sync exec calls block the event loop and cause performance issues.
 */
export declare function execSyncWithDefaults_DEPRECATED(command: string, abortSignal: AbortSignal, timeout?: number): string | null;
export {};
//# sourceMappingURL=execFileNoThrowPortable.d.ts.map