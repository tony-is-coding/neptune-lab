import { type LSPServerInstance } from './LSPServerInstance.js';
/**
 * LSP Server Manager interface returned by createLSPServerManager.
 * Manages multiple LSP server instances and routes requests based on file extensions.
 */
export type LSPServerManager = {
    /** Initialize the manager by loading all configured LSP servers */
    initialize(): Promise<void>;
    /** Shutdown all running servers and clear state */
    shutdown(): Promise<void>;
    /** Get the LSP server instance for a given file path */
    getServerForFile(filePath: string): LSPServerInstance | undefined;
    /** Ensure the appropriate LSP server is started for the given file */
    ensureServerStarted(filePath: string): Promise<LSPServerInstance | undefined>;
    /** Send a request to the appropriate LSP server for the given file */
    sendRequest<T>(filePath: string, method: string, params: unknown): Promise<T | undefined>;
    /** Get all running server instances */
    getAllServers(): Map<string, LSPServerInstance>;
    /** Synchronize file open to LSP server (sends didOpen notification) */
    openFile(filePath: string, content: string): Promise<void>;
    /** Synchronize file change to LSP server (sends didChange notification) */
    changeFile(filePath: string, content: string): Promise<void>;
    /** Synchronize file save to LSP server (sends didSave notification) */
    saveFile(filePath: string): Promise<void>;
    /** Synchronize file close to LSP server (sends didClose notification) */
    closeFile(filePath: string): Promise<void>;
    /** Check if a file is already open on a compatible LSP server */
    isFileOpen(filePath: string): boolean;
};
/**
 * Creates an LSP server manager instance.
 *
 * Manages multiple LSP server instances and routes requests based on file extensions.
 * Uses factory function pattern with closures for state encapsulation (avoiding classes).
 *
 * @returns LSP server manager instance
 *
 * @example
 * const manager = createLSPServerManager()
 * await manager.initialize()
 * const result = await manager.sendRequest('/path/to/file.ts', 'textDocument/definition', params)
 * await manager.shutdown()
 */
export declare function createLSPServerManager(): LSPServerManager;
//# sourceMappingURL=LSPServerManager.d.ts.map