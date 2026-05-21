import type { MCPServerConnection } from '../services/mcp/types.js';
export interface Diagnostic {
    message: string;
    severity: 'Error' | 'Warning' | 'Info' | 'Hint';
    range: {
        start: {
            line: number;
            character: number;
        };
        end: {
            line: number;
            character: number;
        };
    };
    source?: string;
    code?: string;
}
export interface DiagnosticFile {
    uri: string;
    diagnostics: Diagnostic[];
}
export declare class DiagnosticTrackingService {
    private static instance;
    private baseline;
    private initialized;
    private mcpClient;
    private lastProcessedTimestamps;
    private rightFileDiagnosticsState;
    static getInstance(): DiagnosticTrackingService;
    initialize(mcpClient: MCPServerConnection): void;
    shutdown(): Promise<void>;
    /**
     * Reset tracking state while keeping the service initialized.
     * This clears all tracked files and diagnostics.
     */
    reset(): void;
    private normalizeFileUri;
    /**
     * Ensure a file is opened in the IDE before processing.
     * This is important for language services like diagnostics to work properly.
     */
    ensureFileOpened(fileUri: string): Promise<void>;
    /**
     * Capture baseline diagnostics for a specific file before editing.
     * This is called before editing a file to ensure we have a baseline to compare against.
     */
    beforeFileEdited(filePath: string): Promise<void>;
    /**
     * Get new diagnostics from file://, _claude_fs_right, and _claude_fs_ URIs that aren't in the baseline.
     * Only processes diagnostics for files that have been edited.
     */
    getNewDiagnostics(): Promise<DiagnosticFile[]>;
    private parseDiagnosticResult;
    private areDiagnosticsEqual;
    private areDiagnosticArraysEqual;
    /**
     * Handle the start of a new query. This method:
     * - Initializes the diagnostic tracker if not already initialized
     * - Resets the tracker if already initialized (for new query loops)
     * - Automatically finds the IDE client from the provided clients list
     *
     * @param clients Array of MCP clients that may include an IDE client
     * @param shouldQuery Whether a query is actually being made (not just a command)
     */
    handleQueryStart(clients: MCPServerConnection[]): Promise<void>;
    /**
     * Format diagnostics into a human-readable summary string.
     * This is useful for displaying diagnostics in messages or logs.
     *
     * @param files Array of diagnostic files to format
     * @returns Formatted string representation of the diagnostics
     */
    static formatDiagnosticsSummary(files: DiagnosticFile[]): string;
    /**
     * Get the severity symbol for a diagnostic
     */
    static getSeveritySymbol(severity: Diagnostic['severity']): string;
}
export declare const diagnosticTracker: DiagnosticTrackingService;
//# sourceMappingURL=diagnosticTracking.d.ts.map