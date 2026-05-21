type MemoizedFunction<Args extends unknown[], Result> = {
    (...args: Args): Result;
    cache: {
        clear: () => void;
    };
};
type LRUMemoizedFunction<Args extends unknown[], Result> = {
    (...args: Args): Result;
    cache: {
        clear: () => void;
        size: () => number;
        delete: (key: string) => boolean;
        get: (key: string) => Result | undefined;
        has: (key: string) => boolean;
    };
};
/**
 * Creates a memoized function that returns cached values while refreshing in parallel.
 * This implements a write-through cache pattern:
 * - If cache is fresh, return immediately
 * - If cache is stale, return the stale value but refresh it in the background
 * - If no cache exists, block and compute the value
 *
 * @param f The function to memoize
 * @param cacheLifetimeMs The lifetime of cached values in milliseconds
 * @returns A memoized version of the function
 */
export declare function memoizeWithTTL<Args extends unknown[], Result>(f: (...args: Args) => Result, cacheLifetimeMs?: number): MemoizedFunction<Args, Result>;
/**
 * Creates a memoized async function that returns cached values while refreshing in parallel.
 * This implements a write-through cache pattern for async functions:
 * - If cache is fresh, return immediately
 * - If cache is stale, return the stale value but refresh it in the background
 * - If no cache exists, block and compute the value
 *
 * @param f The async function to memoize
 * @param cacheLifetimeMs The lifetime of cached values in milliseconds
 * @returns A memoized version of the async function
 */
export declare function memoizeWithTTLAsync<Args extends unknown[], Result>(f: (...args: Args) => Promise<Result>, cacheLifetimeMs?: number): ((...args: Args) => Promise<Result>) & {
    cache: {
        clear: () => void;
    };
};
/**
 * Creates a memoized function with LRU (Least Recently Used) eviction policy.
 * This prevents unbounded memory growth by evicting the least recently used entries
 * when the cache reaches its maximum size.
 *
 * Note: Cache size for memoized message processing functions
 * Chosen to prevent unbounded memory growth (was 300MB+ with lodash memoize)
 * while maintaining good cache hit rates for typical conversations.
 *
 * @param f The function to memoize
 * @returns A memoized version of the function with cache management methods
 */
export declare function memoizeWithLRU<Args extends unknown[], Result extends NonNullable<unknown>>(f: (...args: Args) => Result, cacheFn: (...args: Args) => string, maxCacheSize?: number): LRUMemoizedFunction<Args, Result>;
export {};
//# sourceMappingURL=memoize.d.ts.map