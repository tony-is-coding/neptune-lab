import type { DiagnosticFile } from '../diagnosticTracking.js';
/**
 * Pending LSP diagnostic notification
 */
export type PendingLSPDiagnostic = {
    /** Server that sent the diagnostic */
    serverName: string;
    /** Diagnostic files */
    files: DiagnosticFile[];
    /** When diagnostic was received */
    timestamp: number;
    /** Whether attachment was already sent to conversation */
    attachmentSent: boolean;
};
/**
 * Register LSP diagnostics received from a server.
 * These will be delivered as attachments in the next query.
 *
 * @param serverName - Name of LSP server that sent diagnostics
 * @param files - Diagnostic files to deliver
 */
export declare function registerPendingLSPDiagnostic({ serverName, files, }: {
    serverName: string;
    files: DiagnosticFile[];
}): void;
/**
 * Get all pending LSP diagnostics that haven't been delivered yet.
 * Deduplicates diagnostics to prevent sending the same diagnostic multiple times.
 * Marks diagnostics as sent to prevent duplicate delivery.
 *
 * @returns Array of pending diagnostics ready for delivery (deduplicated)
 */
export declare function checkForLSPDiagnostics(): Array<{
    serverName: string;
    files: DiagnosticFile[];
}>;
/**
 * Clear all pending diagnostics.
 * Used during cleanup/shutdown or for testing.
 * Note: Does NOT clear deliveredDiagnostics - that's for cross-turn deduplication
 * and should only be cleared when files are edited or on session reset.
 */
export declare function clearAllLSPDiagnostics(): void;
/**
 * Reset all diagnostic state including cross-turn tracking.
 * Used on session reset or for testing.
 */
export declare function resetAllLSPDiagnosticState(): void;
/**
 * Clear delivered diagnostics for a specific file.
 * Should be called when a file is edited so that new diagnostics for that file
 * will be shown even if they match previously delivered ones.
 *
 * @param fileUri - URI of the file that was edited
 */
export declare function clearDeliveredDiagnosticsForFile(fileUri: string): void;
/**
 * Get count of pending diagnostics (for monitoring)
 */
export declare function getPendingLSPDiagnosticCount(): number;
//# sourceMappingURL=LSPDiagnosticRegistry.d.ts.map