import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { type JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
type WebSocketLike = {
    readonly readyState: number;
    close(): void;
    send(data: string): void;
};
export declare class WebSocketTransport implements Transport {
    private ws;
    private started;
    private opened;
    private isBun;
    constructor(ws: WebSocketLike);
    onclose?: () => void;
    onerror?: (error: Error) => void;
    onmessage?: (message: JSONRPCMessage) => void;
    private onBunMessage;
    private onBunError;
    private onBunClose;
    private onNodeMessage;
    private onNodeError;
    private onNodeClose;
    private handleError;
    private handleCloseCleanup;
    /**
     * Starts listening for messages on the WebSocket.
     */
    start(): Promise<void>;
    /**
     * Closes the WebSocket connection.
     */
    close(): Promise<void>;
    /**
     * Sends a JSON-RPC message over the WebSocket connection.
     */
    send(message: JSONRPCMessage): Promise<void>;
}
export {};
//# sourceMappingURL=mcpWebSocketTransport.d.ts.map