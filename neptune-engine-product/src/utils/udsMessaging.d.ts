/**
 * UDS Messaging Layer — Unix Domain Socket IPC for Claude Code instances.
 *
 * Each session auto-creates a UDS server so peer sessions can send messages.
 * Protocol: newline-delimited JSON (NDJSON), one message per line.
 *
 * Socket path defaults to a tmpdir-based path derived from the session PID,
 * but can be overridden via --messaging-socket-path.
 */
export type UdsMessageType = 'text' | 'notification' | 'query' | 'response' | 'ping' | 'pong';
export type UdsMessage = {
    /** Discriminator */
    type: UdsMessageType;
    /** Payload text / JSON content */
    data?: string;
    /** Sender socket path (so the receiver can reply) */
    from?: string;
    /** ISO timestamp */
    ts?: string;
    /** Optional metadata */
    meta?: Record<string, unknown>;
};
export type UdsInboxEntry = {
    id: string;
    message: UdsMessage;
    receivedAt: number;
    status: 'pending' | 'processed';
};
/**
 * Default socket path based on PID, placed in a tmpdir subdirectory so it
 * survives across config-home changes and avoids polluting ~/.claude.
 */
export declare function getDefaultUdsSocketPath(): string;
/**
 * Returns the socket path of the currently running server, or undefined
 * if the server has not been started.
 */
export declare function getUdsMessagingSocketPath(): string | undefined;
/**
 * Register a callback invoked whenever a message is enqueued into the inbox.
 * Used by the print/SDK query loop to kick off processing.
 */
export declare function setOnEnqueue(cb: (() => void) | null): void;
/**
 * Drain all pending inbox messages, marking them processed.
 */
export declare function drainInbox(): UdsInboxEntry[];
/**
 * Start the UDS messaging server on the given socket path.
 *
 * Exports `CLAUDE_CODE_MESSAGING_SOCKET` into `process.env` so child
 * processes (hooks, spawned agents) can discover and connect back.
 */
export declare function startUdsMessaging(path: string, opts?: {
    isExplicit?: boolean;
}): Promise<void>;
/**
 * Stop the UDS messaging server and clean up the socket file.
 */
export declare function stopUdsMessaging(): Promise<void>;
/**
 * Send a UDS message to a specific socket path (outbound — used when this
 * session wants to push a message to a peer's server).
 */
export declare function sendUdsMessage(targetSocketPath: string, message: UdsMessage): Promise<void>;
//# sourceMappingURL=udsMessaging.d.ts.map