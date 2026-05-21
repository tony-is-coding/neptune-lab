/**
 * Binary file extensions to skip for text-based operations.
 * These files can't be meaningfully compared as text and are often large.
 */
export declare const BINARY_EXTENSIONS: Set<string>;
/**
 * Check if a file path has a binary extension.
 */
export declare function hasBinaryExtension(filePath: string): boolean;
/**
 * Check if a buffer contains binary content by looking for null bytes
 * or a high proportion of non-printable characters.
 */
export declare function isBinaryContent(buffer: Buffer): boolean;
//# sourceMappingURL=files.d.ts.map