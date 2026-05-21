/**
 * UDS Client — connect to peer Claude Code sessions via Unix Domain Sockets.
 *
 * Peers are discovered by reading the PID-file registry in ~/.claude/sessions/
 * (written by concurrentSessions.ts) and checking each entry's
 * `messagingSocketPath` field. A peer is "alive" if its PID is running and
 * its socket accepts a ping/pong round-trip.
 */
import { type Socket } from 'net';
import type { SessionKind } from './concurrentSessions.js';
export type PeerSession = {
    pid: number;
    sessionId?: string;
    cwd?: string;
    startedAt?: number;
    kind?: SessionKind;
    name?: string;
    messagingSocketPath?: string;
    entrypoint?: string;
    bridgeSessionId?: string | null;
    alive: boolean;
};
/**
 * List all live sessions from the PID registry, optionally probing their
 * UDS sockets for liveness. Sessions whose PID is no longer running are
 * excluded (and their stale files cleaned up).
 */
export declare function listAllLiveSessions(): Promise<PeerSession[]>;
/**
 * List peer sessions that have a UDS messaging socket (i.e. can receive
 * messages). Excludes the current process.
 */
export declare function listPeers(): Promise<PeerSession[]>;
/**
 * Probe a UDS socket to check if a server is listening (ping/pong).
 * Returns true if the peer responds within the timeout.
 */
export declare function isPeerAlive(socketPath: string, timeoutMs?: number): Promise<boolean>;
/**
 * Send a text message to a peer's UDS socket. This is the high-level helper
 * used by SendMessageTool for `uds:<path>` addresses.
 */
export declare function sendToUdsSocket(targetSocketPath: string, message: string | Record<string, unknown>): Promise<void>;
/**
 * Connect to a peer and return the raw socket for bidirectional communication.
 * The caller is responsible for managing the connection lifecycle.
 */
export declare function connectToPeer(socketPath: string): Promise<Socket>;
/**
 * Disconnect a previously connected peer socket.
 */
export declare function disconnectPeer(socket: Socket): void;
//# sourceMappingURL=udsClient.d.ts.map