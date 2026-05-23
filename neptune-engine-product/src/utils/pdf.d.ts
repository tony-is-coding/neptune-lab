export type PDFError = {
    reason: 'empty' | 'too_large' | 'password_protected' | 'corrupted' | 'unknown' | 'unavailable';
    message: string;
};
export type PDFResult<T> = {
    success: true;
    data: T;
} | {
    success: false;
    error: PDFError;
};
/**
 * Read a PDF file and return it as base64-encoded data.
 * @param filePath Path to the PDF file
 * @returns Result containing PDF data or a structured error
 */
export declare function readPDF(filePath: string): Promise<PDFResult<{
    type: 'pdf';
    file: {
        filePath: string;
        base64: string;
        originalSize: number;
    };
}>>;
/**
 * Get the number of pages in a PDF file using `pdfinfo` (from poppler-utils).
 * Returns `null` if pdfinfo is not available or if the page count cannot be determined.
 */
export declare function getPDFPageCount(filePath: string): Promise<number | null>;
export type PDFExtractPagesResult = {
    type: 'parts';
    file: {
        filePath: string;
        originalSize: number;
        count: number;
        outputDir: string;
    };
};
/**
 * Reset the pdftoppm availability cache. Used by tests only.
 */
export declare function resetPdftoppmCache(): void;
/**
 * Check whether the `pdftoppm` binary (from poppler-utils) is available.
 * The result is cached for the lifetime of the process.
 */
export declare function isPdftoppmAvailable(): Promise<boolean>;
/**
 * Extract PDF pages as JPEG images using pdftoppm.
 * Produces page-01.jpg, page-02.jpg, etc. in an output directory.
 * This enables reading large PDFs and works with all API providers.
 *
 * @param filePath Path to the PDF file
 * @param options Optional page range (1-indexed, inclusive)
 */
export declare function extractPDFPages(filePath: string, options?: {
    firstPage?: number;
    lastPage?: number;
}): Promise<PDFResult<PDFExtractPagesResult>>;
//# sourceMappingURL=pdf.d.ts.map