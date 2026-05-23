import type { Entry, TranscriptMessage } from '../../types/logs.js';
/**
 * Append a log entry to the session using JWT token
 * Uses optimistic concurrency control with Last-Uuid header
 * Ensures sequential execution per session to prevent race conditions
 */
export declare function appendSessionLog(sessionId: string, entry: TranscriptMessage, url: string): Promise<boolean>;
/**
 * Get all session logs for hydration
 */
export declare function getSessionLogs(sessionId: string, url: string): Promise<Entry[] | null>;
/**
 * Get all session logs for hydration via OAuth
 * Used for teleporting sessions from the Sessions API
 */
export declare function getSessionLogsViaOAuth(sessionId: string, accessToken: string, orgUUID: string): Promise<Entry[] | null>;
/**
 * Get worker events (transcript) via the CCR v2 Sessions API. Replaces
 * getSessionLogsViaOAuth once session-ingress is retired.
 *
 * The server dispatches per-session: Spanner for v2-native sessions,
 * threadstore for pre-backfill session_* IDs. The cursor is opaque to us —
 * echo it back until next_cursor is unset.
 *
 * Paginated (500/page default, server max 1000). session-ingress's one-shot
 * 50k is gone; we loop.
 */
export declare function getTeleportEvents(sessionId: string, accessToken: string, orgUUID: string): Promise<Entry[] | null>;
/**
 * Clear cached state for a session
 */
export declare function clearSession(sessionId: string): void;
/**
 * Clear all cached session state (all sessions).
 * Use this on /clear to free sub-agent session entries.
 */
export declare function clearAllSessions(): void;
//# sourceMappingURL=sessionIngress.d.ts.map