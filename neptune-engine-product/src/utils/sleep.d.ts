/**
 * Abort-responsive sleep. Resolves after `ms` milliseconds, or immediately
 * when `signal` aborts (so backoff loops don't block shutdown).
 *
 * By default, abort resolves silently; the caller should check
 * `signal.aborted` after the await. Pass `throwOnAbort: true` to have
 * abort reject — useful when the sleep is deep inside a retry loop
 * and you want the rejection to bubble up and cancel the whole operation.
 *
 * Pass `abortError` to customize the rejection error (implies
 * `throwOnAbort: true`). Useful for retry loops that catch a specific
 * error class (e.g. `APIUserAbortError`).
 */
export declare function sleep(ms: number, signal?: AbortSignal, opts?: {
    throwOnAbort?: boolean;
    abortError?: () => Error;
    unref?: boolean;
}): Promise<void>;
/**
 * Race a promise against a timeout. Rejects with `Error(message)` if the
 * promise doesn't settle within `ms`. The timeout timer is cleared when
 * the promise settles (no dangling timer) and unref'd so it doesn't
 * block process exit.
 *
 * Note: this doesn't cancel the underlying work — if the promise is
 * backed by a runaway async operation, that keeps running. This just
 * returns control to the caller.
 */
export declare function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T>;
//# sourceMappingURL=sleep.d.ts.map