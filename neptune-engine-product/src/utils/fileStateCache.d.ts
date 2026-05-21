import { LRUCache } from 'lru-cache';
export type FileState = {
    content: string;
    timestamp: number;
    offset: number | undefined;
    limit: number | undefined;
    isPartialView?: boolean;
};
export declare const READ_FILE_STATE_CACHE_SIZE = 100;
/**
 * A file state cache that normalizes all path keys before access.
 * This ensures consistent cache hits regardless of whether callers pass
 * relative vs absolute paths with redundant segments (e.g. /foo/../bar)
 * or mixed path separators on Windows (/ vs \).
 */
export declare class FileStateCache {
    private cache;
    constructor(maxEntries: number, maxSizeBytes: number);
    get(key: string): FileState | undefined;
    set(key: string, value: FileState): this;
    has(key: string): boolean;
    delete(key: string): boolean;
    clear(): void;
    get size(): number;
    get max(): number;
    get maxSize(): number;
    get calculatedSize(): number;
    keys(): Generator<string>;
    entries(): Generator<[string, FileState]>;
    dump(): ReturnType<LRUCache<string, FileState>['dump']>;
    load(entries: ReturnType<LRUCache<string, FileState>['dump']>): void;
}
/**
 * Factory function to create a size-limited FileStateCache.
 * Uses LRUCache's built-in size-based eviction to prevent memory bloat.
 * Note: Images are not cached (see FileReadTool) so size limit is mainly
 * for large text files, notebooks, and other editable content.
 */
export declare function createFileStateCacheWithSizeLimit(maxEntries: number, maxSizeBytes?: number): FileStateCache;
export declare function cacheToObject(cache: FileStateCache): Record<string, FileState>;
export declare function cacheKeys(cache: FileStateCache): string[];
export declare function cloneFileStateCache(cache: FileStateCache): FileStateCache;
export declare function mergeFileStateCaches(first: FileStateCache, second: FileStateCache): FileStateCache;
//# sourceMappingURL=fileStateCache.d.ts.map