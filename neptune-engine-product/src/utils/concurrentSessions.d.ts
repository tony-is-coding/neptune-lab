export type SessionKind = 'interactive' | 'bg' | 'daemon' | 'daemon-worker';
export type SessionStatus = 'busy' | 'idle' | 'waiting';
/**
 * True when this REPL is running inside a `claude --bg` tmux session.
 * Exit paths (/exit, ctrl+c, ctrl+d) should detach the attached client
 * instead of killing the process.
 */
export declare function isBgSession(): boolean;
/**
 * Write a PID file for this session and register cleanup.
 *
 * Registers all top-level sessions — interactive CLI, SDK (vscode, desktop,
 * typescript, python, -p), bg/daemon spawns — so `claude ps` sees everything
 * the user might be running. Skips only teammates/subagents, which would
 * conflate swarm usage with genuine concurrency and pollute ps with noise.
 *
 * Returns true if registered, false if skipped.
 * Errors logged to debug, never thrown.
 */
export declare function registerSession(): Promise<boolean>;
export declare function updateSessionName(name: string | undefined): Promise<void>;
/**
 * Record this session's Remote Control session ID so peer enumeration can
 * dedup: a session reachable over both UDS and bridge should only appear
 * once (local wins). Cleared on bridge teardown so stale IDs don't
 * suppress a legitimately-remote session after reconnect.
 */
export declare function updateSessionBridgeId(bridgeSessionId: string | null): Promise<void>;
/**
 * Push live activity state for `claude ps`. Fire-and-forget from REPL's
 * status-change effect — a dropped write just means ps falls back to
 * transcript-tail derivation for one refresh.
 */
export declare function updateSessionActivity(patch: {
    status?: SessionStatus;
    waitingFor?: string;
}): Promise<void>;
/**
 * Count live concurrent CLI sessions (including this one).
 * Filters out stale PID files (crashed sessions) and deletes them.
 * Returns 0 on any error (conservative).
 */
export declare function countConcurrentSessions(): Promise<number>;
//# sourceMappingURL=concurrentSessions.d.ts.map