/**
 * State tracker for zip file validation during extraction
 */
type ZipValidationState = {
    fileCount: number;
    totalUncompressedSize: number;
    compressedSize: number;
    errors: string[];
};
/**
 * File metadata from fflate filter
 */
type ZipFileMetadata = {
    name: string;
    originalSize?: number;
};
/**
 * Result of validating a single file in a zip archive
 */
type FileValidationResult = {
    isValid: boolean;
    error?: string;
};
/**
 * Validates a file path to prevent path traversal attacks
 */
export declare function isPathSafe(filePath: string): boolean;
/**
 * Validates a single file during zip extraction
 */
export declare function validateZipFile(file: ZipFileMetadata, state: ZipValidationState): FileValidationResult;
/**
 * Unzips data from a Buffer and returns its contents as a record of file paths to Uint8Array data.
 * Uses unzipSync to avoid fflate worker termination crashes in bun.
 * Accepts raw zip bytes so that the caller can read the file asynchronously.
 *
 * fflate is lazy-imported to avoid its ~196KB of top-level lookup tables (revfd
 * Int32Array(32769), rev Uint16Array(32768), etc.) being allocated at startup
 * when this module is reached via the plugin loader chain.
 */
export declare function unzipFile(zipData: Buffer): Promise<Record<string, Uint8Array>>;
/**
 * Parse Unix file modes from a zip's central directory.
 *
 * fflate's `unzipSync` returns only `Record<string, Uint8Array>` — it does not
 * surface the external file attributes stored in the central directory. This
 * means executable bits are lost during extraction (everything becomes 0644).
 * The git-clone path preserves +x natively, but the GCS/zip path needs this
 * helper to keep parity.
 *
 * Returns `name → mode` for entries created on a Unix host (`versionMadeBy`
 * high byte === 3). Entries from other hosts, or with no mode bits set, are
 * omitted. Callers should treat a missing key as "use default mode".
 *
 * Format per PKZIP APPNOTE.TXT §4.3.12 (central directory) and §4.3.16 (EOCD).
 * ZIP64 is not handled — returns `{}` on archives >4GB or >65535 entries,
 * which is fine for marketplace zips (~3.5MB) and MCPB bundles.
 */
export declare function parseZipModes(data: Uint8Array): Record<string, number>;
/**
 * Reads a zip file from disk asynchronously and unzips it.
 * Returns its contents as a record of file paths to Uint8Array data.
 */
export declare function readAndUnzipFile(filePath: string): Promise<Record<string, Uint8Array>>;
export {};
//# sourceMappingURL=zip.d.ts.map