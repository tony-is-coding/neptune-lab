import type { PublishDiagnosticsParams } from 'vscode-languageserver-protocol';
import type { DiagnosticFile } from '../diagnosticTracking.js';
import type { LSPServerManager } from './LSPServerManager.js';
/**
 * Convert LSP diagnostics to Claude diagnostic format
 *
 * Converts LSP PublishDiagnosticsParams to DiagnosticFile[] format
 * used by Claude's attachment system.
 */
export declare function formatDiagnosticsForAttachment(params: PublishDiagnosticsParams): DiagnosticFile[];
/**
 * Handler registration result with tracking data
 */
export type HandlerRegistrationResult = {
    /** Total number of servers */
    totalServers: number;
    /** Number of successful registrations */
    successCount: number;
    /** Registration errors per server */
    registrationErrors: Array<{
        serverName: string;
        error: string;
    }>;
    /** Runtime failure tracking (shared across all handler invocations) */
    diagnosticFailures: Map<string, {
        count: number;
        lastError: string;
    }>;
};
/**
 * Register LSP notification handlers on all servers
 *
 * Sets up handlers to listen for textDocument/publishDiagnostics notifications
 * from all LSP servers and routes them to Claude's diagnostic system.
 * Uses public getAllServers() API for clean access to server instances.
 *
 * @returns Tracking data for registration status and runtime failures
 */
export declare function registerLSPNotificationHandlers(manager: LSPServerManager): HandlerRegistrationResult;
//# sourceMappingURL=passiveFeedback.d.ts.map