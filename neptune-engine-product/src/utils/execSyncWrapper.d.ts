import { type ExecSyncOptions, type ExecSyncOptionsWithBufferEncoding, type ExecSyncOptionsWithStringEncoding } from 'child_process';
/**
 * @deprecated Use async alternatives when possible. Sync exec calls block the event loop.
 *
 * Wrapped execSync with slow operation logging.
 * Use this instead of child_process execSync directly to detect performance issues.
 *
 * @example
 * import { execSync_DEPRECATED } from './execSyncWrapper.js'
 * const result = execSync_DEPRECATED('git status', { encoding: 'utf8' })
 */
export declare function execSync_DEPRECATED(command: string): Buffer;
export declare function execSync_DEPRECATED(command: string, options: ExecSyncOptionsWithStringEncoding): string;
export declare function execSync_DEPRECATED(command: string, options: ExecSyncOptionsWithBufferEncoding): Buffer;
export declare function execSync_DEPRECATED(command: string, options?: ExecSyncOptions): Buffer | string;
//# sourceMappingURL=execSyncWrapper.d.ts.map