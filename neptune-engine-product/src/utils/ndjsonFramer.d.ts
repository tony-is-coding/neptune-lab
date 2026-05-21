/**
 * Shared NDJSON (Newline-Delimited JSON) socket framing.
 *
 * Accumulates incoming data chunks, splits on newlines, and emits
 * parsed JSON objects. Used by both pipeTransport (UDS+TCP) and
 * udsMessaging to avoid duplicating the same buffer logic.
 */
import type { Socket } from 'net';
/**
 * Attach an NDJSON framer to a socket. Calls `onMessage` for each
 * complete JSON line received. Malformed lines are silently skipped.
 *
 * @param parse - Optional custom JSON parser (defaults to JSON.parse).
 *                Useful when the caller uses a wrapped parser like jsonParse
 *                from slowOperations.
 */
export declare function attachNdjsonFramer<T = unknown>(socket: Socket, onMessage: (msg: T) => void, parse?: (text: string) => T): void;
//# sourceMappingURL=ndjsonFramer.d.ts.map