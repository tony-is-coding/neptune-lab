/**
 * Lazy accessor for proper-lockfile.
 *
 * proper-lockfile depends on graceful-fs, which monkey-patches every fs
 * method on first require (~8ms). Static imports of proper-lockfile pull this
 * cost into the startup path even when no locking happens (e.g. `--help`).
 *
 * Import this module instead of `proper-lockfile` directly. The underlying
 * package is only loaded the first time a lock function is actually called.
 */
import type { CheckOptions, LockOptions, UnlockOptions } from 'proper-lockfile';
export declare function lock(file: string, options?: LockOptions): Promise<() => Promise<void>>;
export declare function lockSync(file: string, options?: LockOptions): () => void;
export declare function unlock(file: string, options?: UnlockOptions): Promise<void>;
export declare function check(file: string, options?: CheckOptions): Promise<boolean>;
//# sourceMappingURL=lockfile.d.ts.map