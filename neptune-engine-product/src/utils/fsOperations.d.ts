import * as fs from 'fs';
/**
 * Simplified filesystem operations interface based on Node.js fs module.
 * Provides a subset of commonly used sync operations with type safety.
 * Allows abstraction for alternative implementations (e.g., mock, virtual).
 */
export type FsOperations = {
    /** Gets the current working directory */
    cwd(): string;
    /** Checks if a file or directory exists */
    existsSync(path: string): boolean;
    /** Gets file stats asynchronously */
    stat(path: string): Promise<fs.Stats>;
    /** Lists directory contents with file type information asynchronously */
    readdir(path: string): Promise<fs.Dirent[]>;
    /** Deletes file asynchronously */
    unlink(path: string): Promise<void>;
    /** Removes an empty directory asynchronously */
    rmdir(path: string): Promise<void>;
    /** Removes files and directories asynchronously (with recursive option) */
    rm(path: string, options?: {
        recursive?: boolean;
        force?: boolean;
    }): Promise<void>;
    /** Creates directory recursively asynchronously. */
    mkdir(path: string, options?: {
        mode?: number;
    }): Promise<void>;
    /** Reads file content as string asynchronously */
    readFile(path: string, options: {
        encoding: BufferEncoding;
    }): Promise<string>;
    /** Renames/moves file asynchronously */
    rename(oldPath: string, newPath: string): Promise<void>;
    /** Gets file stats */
    statSync(path: string): fs.Stats;
    /** Gets file stats without following symlinks */
    lstatSync(path: string): fs.Stats;
    /** Reads file content as string with specified encoding */
    readFileSync(path: string, options: {
        encoding: BufferEncoding;
    }): string;
    /** Reads raw file bytes as Buffer */
    readFileBytesSync(path: string): Buffer;
    /** Reads specified number of bytes from file start */
    readSync(path: string, options: {
        length: number;
    }): {
        buffer: Buffer;
        bytesRead: number;
    };
    /** Appends string to file */
    appendFileSync(path: string, data: string, options?: {
        mode?: number;
    }): void;
    /** Copies file from source to destination */
    copyFileSync(src: string, dest: string): void;
    /** Deletes file */
    unlinkSync(path: string): void;
    /** Renames/moves file */
    renameSync(oldPath: string, newPath: string): void;
    /** Creates hard link */
    linkSync(target: string, path: string): void;
    /** Creates symbolic link */
    symlinkSync(target: string, path: string, type?: 'dir' | 'file' | 'junction'): void;
    /** Reads symbolic link */
    readlinkSync(path: string): string;
    /** Resolves symbolic links and returns the canonical pathname */
    realpathSync(path: string): string;
    /** Creates directory recursively. Mode defaults to 0o777 & ~umask if not specified. */
    mkdirSync(path: string, options?: {
        mode?: number;
    }): void;
    /** Lists directory contents with file type information */
    readdirSync(path: string): fs.Dirent[];
    /** Lists directory contents as strings */
    readdirStringSync(path: string): string[];
    /** Checks if the directory is empty */
    isDirEmptySync(path: string): boolean;
    /** Removes an empty directory */
    rmdirSync(path: string): void;
    /** Removes files and directories (with recursive option) */
    rmSync(path: string, options?: {
        recursive?: boolean;
        force?: boolean;
    }): void;
    /** Create a writable stream for writing data to a file. */
    createWriteStream(path: string): fs.WriteStream;
    /** Reads raw file bytes as Buffer asynchronously.
     *  When maxBytes is set, only reads up to that many bytes. */
    readFileBytes(path: string, maxBytes?: number): Promise<Buffer>;
};
/**
 * Safely resolves a file path, handling symlinks and errors gracefully.
 *
 * Error handling strategy:
 * - If the file doesn't exist, returns the original path (allows for file creation)
 * - If symlink resolution fails (broken symlink, permission denied, circular links),
 *   returns the original path and marks it as not a symlink
 * - This ensures operations can continue with the original path rather than failing
 *
 * @param fs The filesystem implementation to use
 * @param filePath The path to resolve
 * @returns Object containing the resolved path and whether it was a symlink
 */
export declare function safeResolvePath(fs: FsOperations, filePath: string): {
    resolvedPath: string;
    isSymlink: boolean;
    isCanonical: boolean;
};
/**
 * Check if a file path is a duplicate and should be skipped.
 * Resolves symlinks to detect duplicates pointing to the same file.
 * If not a duplicate, adds the resolved path to loadedPaths.
 *
 * @returns true if the file should be skipped (is duplicate)
 */
export declare function isDuplicatePath(fs: FsOperations, filePath: string, loadedPaths: Set<string>): boolean;
/**
 * Resolve the deepest existing ancestor of a path via realpathSync, walking
 * up until it succeeds. Detects dangling symlinks (link entry exists, target
 * doesn't) via lstat and resolves them via readlink.
 *
 * Use when the input path may not exist (new file writes) and you need to
 * know where the write would ACTUALLY land after the OS follows symlinks.
 *
 * Returns the resolved absolute path with non-existent tail segments
 * rejoined, or undefined if no symlink was found in any existing ancestor
 * (the path's existing ancestors all resolve to themselves).
 *
 * Handles: live parent symlinks, dangling file symlinks, dangling parent
 * symlinks. Same core algorithm as teamMemPaths.ts:realpathDeepestExisting.
 */
export declare function resolveDeepestExistingAncestorSync(fs: FsOperations, absolutePath: string): string | undefined;
/**
 * Gets all paths that should be checked for permissions.
 * This includes the original path, all intermediate symlink targets in the chain,
 * and the final resolved path.
 *
 * For example, if test.txt -> /etc/passwd -> /private/etc/passwd:
 * - test.txt (original path)
 * - /etc/passwd (intermediate symlink target)
 * - /private/etc/passwd (final resolved path)
 *
 * This is important for security: a deny rule for /etc/passwd should block
 * access even if the file is actually at /private/etc/passwd (as on macOS).
 *
 * @param path - The path to check (will be converted to absolute)
 * @returns An array of absolute paths to check permissions for
 */
export declare function getPathsForPermissionCheck(inputPath: string): string[];
export declare const NodeFsOperations: FsOperations;
/**
 * Overrides the filesystem implementation. Note: This function does not
 * automatically update cwd.
 * @param implementation The filesystem implementation to use
 */
export declare function setFsImplementation(implementation: FsOperations): void;
/**
 * Gets the currently active filesystem implementation
 * @returns The currently active filesystem implementation
 */
export declare function getFsImplementation(): FsOperations;
/**
 * Resets the filesystem implementation to the default Node.js implementation.
 * Note: This function does not automatically update cwd.
 */
export declare function setOriginalFsImplementation(): void;
export type ReadFileRangeResult = {
    content: string;
    bytesRead: number;
    bytesTotal: number;
};
/**
 * Read up to `maxBytes` from a file starting at `offset`.
 * Returns a flat string from Buffer — no sliced string references to a
 * larger parent. Returns null if the file is smaller than the offset.
 */
export declare function readFileRange(path: string, offset: number, maxBytes: number): Promise<ReadFileRangeResult | null>;
/**
 * Read the last `maxBytes` of a file.
 * Returns the whole file if it's smaller than maxBytes.
 */
export declare function tailFile(path: string, maxBytes: number): Promise<ReadFileRangeResult>;
/**
 * Async generator that yields lines from a file in reverse order.
 * Reads the file backwards in chunks to avoid loading the entire file into memory.
 * @param path - The path to the file to read
 * @returns An async generator that yields lines in reverse order
 */
export declare function readLinesReverse(path: string): AsyncGenerator<string, void, undefined>;
//# sourceMappingURL=fsOperations.d.ts.map