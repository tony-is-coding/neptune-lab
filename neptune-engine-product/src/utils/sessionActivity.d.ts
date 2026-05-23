/**
 * Session activity tracking with refcount-based heartbeat timer.
 *
 * The transport registers its keep-alive sender via registerSessionActivityCallback().
 * Callers (API streaming, tool execution) bracket their work with
 * startSessionActivity() / stopSessionActivity(). When the refcount is >0 a
 * periodic timer fires the registered callback every 30 seconds to keep the
 * container alive.
 *
 * Sending keep-alives is gated behind CLAUDE_CODE_REMOTE_SEND_KEEPALIVES.
 * Diagnostic logging always fires to help diagnose idle gaps.
 */
export type SessionActivityReason = 'api_call' | 'tool_exec';
export declare function registerSessionActivityCallback(cb: () => void): void;
export declare function unregisterSessionActivityCallback(): void;
export declare function sendSessionActivitySignal(): void;
export declare function isSessionActivityTrackingActive(): boolean;
/**
 * Increment the activity refcount. When it transitions from 0→1 and a callback
 * is registered, start a periodic heartbeat timer.
 */
export declare function startSessionActivity(reason: SessionActivityReason): void;
/**
 * Decrement the activity refcount. When it reaches 0, stop the heartbeat timer
 * and start an idle timer that logs after 30s of inactivity.
 */
export declare function stopSessionActivity(reason: SessionActivityReason): void;
//# sourceMappingURL=sessionActivity.d.ts.map