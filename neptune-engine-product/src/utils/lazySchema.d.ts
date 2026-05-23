/**
 * Returns a memoized factory function that constructs the value on first call.
 * Used to defer Zod schema construction from module init time to first access.
 */
export declare function lazySchema<T>(factory: () => T): () => T;
//# sourceMappingURL=lazySchema.d.ts.map