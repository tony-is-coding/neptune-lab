export declare const DOCUMENT_EXTENSIONS: Set<string>;
/**
 * Parse a page range string into firstPage/lastPage numbers.
 * Supported formats:
 * - "5" → { firstPage: 5, lastPage: 5 }
 * - "1-10" → { firstPage: 1, lastPage: 10 }
 * - "3-" → { firstPage: 3, lastPage: Infinity }
 *
 * Returns null on invalid input (non-numeric, zero, inverted range).
 * Pages are 1-indexed.
 */
export declare function parsePDFPageRange(pages: string): {
    firstPage: number;
    lastPage: number;
} | null;
/**
 * Check if PDF reading is supported with the current model.
 * PDF document blocks work on all providers (1P, Vertex, Bedrock, Foundry).
 * Haiku 3 is the only remaining model that predates PDF support; users on
 * it fall back to the page-extraction path (poppler-utils). Substring match
 * covers all provider ID formats (Bedrock prefixes, Vertex @-dates).
 */
export declare function isPDFSupported(): boolean;
/**
 * Check if a file extension is a PDF document.
 * @param ext File extension (with or without leading dot)
 */
export declare function isPDFExtension(ext: string): boolean;
//# sourceMappingURL=pdfUtils.d.ts.map