/**
 * Creates a combined AbortSignal that aborts when the input signal aborts,
 * an optional second signal aborts, or an optional timeout elapses.
 * Returns both the signal and a cleanup function that removes event listeners
 * and clears the internal timeout timer.
 *
 * Use `timeoutMs` instead of passing `AbortSignal.timeout(ms)` as a signal —
 * under Bun, `AbortSignal.timeout` timers are finalized lazily and accumulate
 * in native memory until they fire (measured ~2.4KB/call held for the full
 * timeout duration). This implementation uses `setTimeout` + `clearTimeout`
 * so the timer is freed immediately on cleanup.
 */
export declare function createCombinedAbortSignal(signal: AbortSignal | undefined, opts?: {
    signalB?: AbortSignal;
    timeoutMs?: number;
}): {
    signal: AbortSignal;
    cleanup: () => void;
};
//# sourceMappingURL=combinedAbortSignal.d.ts.map