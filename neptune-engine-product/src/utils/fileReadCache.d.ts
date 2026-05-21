/**
 * A simple in-memory cache for file contents with automatic invalidation based on modification time.
 * This eliminates redundant file reads in FileEditTool operations.
 */
declare class FileReadCache {
    private cache;
    private readonly maxCacheSize;
    /**
     * Reads a file with caching. Returns both content and encoding.
     * Cache key includes file path and modification time for automatic invalidation.
     */
    readFile(filePath: string): {
        content: string;
        encoding: BufferEncoding;
    };
    /**
     * Clears the entire cache. Useful for testing or memory management.
     */
    clear(): void;
    /**
     * Removes a specific file from the cache.
     */
    invalidate(filePath: string): void;
    /**
     * Gets cache statistics for debugging/monitoring.
     */
    getStats(): {
        size: number;
        entries: string[];
    };
}
export declare const fileReadCache: FileReadCache;
export {};
//# sourceMappingURL=fileReadCache.d.ts.map