import type { MCPResultType } from '../services/mcp/client.js';
/**
 * Generates a format description string based on the MCP result type and schema.
 */
export declare function getFormatDescription(type: MCPResultType, schema?: unknown): string;
/**
 * Generates instruction text for Claude to read from a saved output file.
 *
 * @param rawOutputPath - Path to the saved output file
 * @param contentLength - Length of the content in characters
 * @param formatDescription - Description of the content format
 * @param maxReadLength - Optional max chars for Read tool (for Bash output context)
 * @returns Instruction text to include in the tool result
 */
export declare function getLargeOutputInstructions(rawOutputPath: string, contentLength: number, formatDescription: string, maxReadLength?: number): string;
/**
 * Map a mime type to a file extension. Conservative: known types get their
 * proper extension; unknown types get 'bin'. The extension matters because
 * the Read tool dispatches on it (PDFs, images, etc. need the right ext).
 */
export declare function extensionForMimeType(mimeType: string | undefined): string;
/**
 * Heuristic for whether a content-type header indicates binary content that
 * should be saved to disk rather than put into the model context.
 * Text-ish types (text/*, json, xml, form data) are treated as non-binary.
 */
export declare function isBinaryContentType(contentType: string): boolean;
export type PersistBinaryResult = {
    filepath: string;
    size: number;
    ext: string;
} | {
    error: string;
};
/**
 * Write raw binary bytes to the tool-results directory with a mime-derived
 * extension. Unlike persistToolResult (which stringifies), this writes the
 * bytes as-is so the resulting file can be opened with native tools (Read
 * for PDFs, pandas for xlsx, etc.).
 */
export declare function persistBinaryContent(bytes: Buffer, mimeType: string | undefined, persistId: string): Promise<PersistBinaryResult>;
/**
 * Build a short message telling Claude where binary content was saved.
 * Just states the path — no prescriptive hint, since what the model can
 * actually do with the file depends on provider/tooling.
 */
export declare function getBinaryBlobSavedMessage(filepath: string, mimeType: string | undefined, size: number, sourceDescription: string): string;
//# sourceMappingURL=mcpOutputStorage.d.ts.map