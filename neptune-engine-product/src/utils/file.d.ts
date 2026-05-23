import { type LineEndingType } from './fileRead.js';
export type File = {
    filename: string;
    content: string;
};
/**
 * Check if a path exists asynchronously.
 */
export declare function pathExists(path: string): Promise<boolean>;
export declare const MAX_OUTPUT_SIZE: number;
export declare function readFileSafe(filepath: string): string | null;
/**
 * Get the normalized modification time of a file in milliseconds.
 * Uses Math.floor to ensure consistent timestamp comparisons across file operations,
 * reducing false positives from sub-millisecond precision changes (e.g., from IDE
 * file watchers that touch files without changing content).
 */
export declare function getFileModificationTime(filePath: string): number;
/**
 * Async variant of getFileModificationTime. Same floor semantics.
 * Use this in async paths (getChangedFiles runs every turn on every readFileState
 * entry — sync statSync there triggers the slow-operation indicator on network/
 * slow disks).
 */
export declare function getFileModificationTimeAsync(filePath: string): Promise<number>;
export declare function writeTextContent(filePath: string, content: string, encoding: BufferEncoding, endings: LineEndingType): void;
export declare function detectFileEncoding(filePath: string): BufferEncoding;
export declare function detectLineEndings(filePath: string, encoding?: BufferEncoding): LineEndingType;
export declare function convertLeadingTabsToSpaces(content: string): string;
export declare function getAbsoluteAndRelativePaths(path: string | undefined): {
    absolutePath: string | undefined;
    relativePath: string | undefined;
};
export declare function getDisplayPath(filePath: string): string;
/**
 * Find files with the same name but different extensions in the same directory
 * @param filePath The path to the file that doesn't exist
 * @returns The found file with a different extension, or undefined if none found
 */
export declare function findSimilarFile(filePath: string): string | undefined;
/**
 * Marker included in file-not-found error messages that contain a cwd note.
 * UI renderers check for this to show a short "File not found" message.
 */
export declare const FILE_NOT_FOUND_CWD_NOTE = "Note: your current working directory is";
/**
 * Suggests a corrected path under the current working directory when a file/directory
 * is not found. Detects the "dropped repo folder" pattern where the model constructs
 * an absolute path missing the repo directory component.
 *
 * Example:
 *   cwd = /Users/zeeg/src/currentRepo
 *   requestedPath = /Users/zeeg/src/foobar           (doesn't exist)
 *   returns        /Users/zeeg/src/currentRepo/foobar (if it exists)
 *
 * @param requestedPath - The absolute path that was not found
 * @returns The corrected path if found under cwd, undefined otherwise
 */
export declare function suggestPathUnderCwd(requestedPath: string): Promise<string | undefined>;
/**
 * Whether to use the compact line-number prefix format (`N\t` instead of
 * `     N→`). The padded-arrow format costs 9 bytes/line overhead; at
 * 1.35B Read calls × 132 lines avg this is 2.18% of fleet uncached input
 * (bq-queries/read_line_prefix_overhead_verify.sql).
 *
 * Ant soak validated no Edit error regression (6.29% vs 6.86% baseline).
 * Killswitch pattern: GB can disable if issues surface externally.
 */
export declare function isCompactLinePrefixEnabled(): boolean;
/**
 * Adds cat -n style line numbers to the content.
 */
export declare function addLineNumbers({ content, startLine, }: {
    content: string;
    startLine: number;
}): string;
/**
 * Inverse of addLineNumbers — strips the `N→` or `N\t` prefix from a single
 * line. Co-located so format changes here and in addLineNumbers stay in sync.
 */
export declare function stripLineNumberPrefix(line: string): string;
/**
 * Checks if a directory is empty.
 * @param dirPath The path to the directory to check
 * @returns true if the directory is empty or does not exist, false otherwise
 */
export declare function isDirEmpty(dirPath: string): boolean;
/**
 * Reads a file with caching to avoid redundant I/O operations.
 * This is the preferred method for FileEditTool operations.
 */
export declare function readFileSyncCached(filePath: string): string;
/**
 * Writes to a file and flushes the file to disk
 * @param filePath The path to the file to write to
 * @param content The content to write to the file
 * @param options Options for writing the file, including encoding and mode
 * @deprecated Use `fs.promises.writeFile` with flush option instead for non-blocking writes.
 * Sync file writes block the event loop and cause performance issues.
 */
export declare function writeFileSyncAndFlush_DEPRECATED(filePath: string, content: string, options?: {
    encoding: BufferEncoding;
    mode?: number;
}): void;
export declare function getDesktopPath(): string;
/**
 * Validates that a file size is within the specified limit.
 * Returns true if the file is within the limit, false otherwise.
 *
 * @param filePath The path to the file to validate
 * @param maxSizeBytes The maximum allowed file size in bytes
 * @returns true if file size is within limit, false otherwise
 */
export declare function isFileWithinReadSizeLimit(filePath: string, maxSizeBytes?: number): boolean;
/**
 * Normalize a file path for comparison, handling platform differences.
 * On Windows, normalizes path separators and converts to lowercase for
 * case-insensitive comparison.
 */
export declare function normalizePathForComparison(filePath: string): string;
/**
 * Compare two file paths for equality, handling Windows case-insensitivity.
 */
export declare function pathsEqual(path1: string, path2: string): boolean;
//# sourceMappingURL=file.d.ts.map