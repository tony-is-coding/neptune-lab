export type AcquireResult = {
    readonly kind: 'acquired';
    readonly fresh: boolean;
} | {
    readonly kind: 'blocked';
    readonly by: string;
};
export type CheckResult = {
    readonly kind: 'free';
} | {
    readonly kind: 'held_by_self';
} | {
    readonly kind: 'blocked';
    readonly by: string;
};
/**
 * Check lock state without acquiring. Used for `request_access` /
 * `list_granted_applications` — the package's `defersLockAcquire` contract:
 * these tools check but don't take the lock, so the enter-notification and
 * overlay don't fire while the model is only asking for permission.
 *
 * Does stale-PID recovery (unlinks) so a dead session's lock doesn't block
 * `request_access`. Does NOT create — that's `tryAcquireComputerUseLock`'s job.
 */
export declare function checkComputerUseLock(): Promise<CheckResult>;
/**
 * Zero-syscall check: does THIS process believe it holds the lock?
 * True iff `tryAcquireComputerUseLock` succeeded and `releaseComputerUseLock`
 * hasn't run yet. Used to gate the per-turn release in `cleanup.ts` so
 * non-CU turns don't touch disk.
 */
export declare function isLockHeldLocally(): boolean;
/**
 * Try to acquire the computer-use lock for the current session.
 *
 * `{kind: 'acquired', fresh: true}` — first tool call of a CU turn. Callers fire
 * enter notifications on this. `{kind: 'acquired', fresh: false}` — re-entrant,
 * same session already holds it. `{kind: 'blocked', by}` — another live session
 * holds it.
 *
 * Uses O_EXCL (open 'wx') for atomic test-and-set — the OS guarantees at
 * most one process sees the create succeed. If the file already exists,
 * we check ownership and PID liveness; for a stale lock we unlink and
 * retry the exclusive create once. If two sessions race to recover the
 * same stale lock, only one create succeeds (the other reads the winner).
 */
export declare function tryAcquireComputerUseLock(): Promise<AcquireResult>;
/**
 * Release the computer-use lock if the current session owns it. Returns
 * `true` if we actually unlinked the file (i.e., we held it) — callers fire
 * exit notifications on this. Idempotent: subsequent calls return `false`.
 */
export declare function releaseComputerUseLock(): Promise<boolean>;
//# sourceMappingURL=computerUseLock.d.ts.map