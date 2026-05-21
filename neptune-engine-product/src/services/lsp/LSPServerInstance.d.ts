import type { LspServerState, ScopedLspServerConfig } from './types.js';
/**
 * LSP server instance interface returned by createLSPServerInstance.
 * Manages the lifecycle of a single LSP server with state tracking and health monitoring.
 */
export type LSPServerInstance = {
    /** Unique server identifier */
    readonly name: string;
    /** Server configuration */
    readonly config: ScopedLspServerConfig;
    /** Current server state */
    readonly state: LspServerState;
    /** When the server was last started */
    readonly startTime: Date | undefined;
    /** Last error encountered */
    readonly lastError: Error | undefined;
    /** Number of times restart() has been called */
    readonly restartCount: number;
    /** Start the server and initialize it */
    start(): Promise<void>;
    /** Stop the server gracefully */
    stop(): Promise<void>;
    /** Manually restart the server (stop then start) */
    restart(): Promise<void>;
    /** Check if server is healthy and ready for requests */
    isHealthy(): boolean;
    /** Send an LSP request to the server */
    sendRequest<T>(method: string, params: unknown): Promise<T>;
    /** Send an LSP notification to the server (fire-and-forget) */
    sendNotification(method: string, params: unknown): Promise<void>;
    /** Register a handler for LSP notifications */
    onNotification(method: string, handler: (params: unknown) => void): void;
    /** Register a handler for LSP requests from the server */
    onRequest<TParams, TResult>(method: string, handler: (params: TParams) => TResult | Promise<TResult>): void;
};
/**
 * Creates and manages a single LSP server instance.
 *
 * Uses factory function pattern with closures for state encapsulation (avoiding classes).
 * Provides state tracking, health monitoring, and request forwarding for an LSP server.
 * Supports manual restart with configurable retry limits.
 *
 * State machine transitions:
 * - stopped → starting → running
 * - running → stopping → stopped
 * - any → error (on failure)
 * - error → starting (on retry)
 *
 * @param name - Unique identifier for this server instance
 * @param config - Server configuration including command, args, and limits
 * @returns LSP server instance with lifecycle management methods
 *
 * @example
 * const instance = createLSPServerInstance('my-server', config)
 * await instance.start()
 * const result = await instance.sendRequest('textDocument/definition', params)
 * await instance.stop()
 */
export declare function createLSPServerInstance(name: string, config: ScopedLspServerConfig): LSPServerInstance;
//# sourceMappingURL=LSPServerInstance.d.ts.map