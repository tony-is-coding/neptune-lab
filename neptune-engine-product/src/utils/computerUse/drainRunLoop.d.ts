declare function retain(): void;
declare function release(): void;
/**
 * Hold a pump reference for the lifetime of a long-lived registration
 * (e.g. the CGEventTap Escape handler). Unlike `drainRunLoop(fn)` this has
 * no timeout — the caller is responsible for calling `releasePump()`. Same
 * refcount as drainRunLoop calls, so nesting is safe.
 */
export declare const retainPump: typeof retain;
export declare const releasePump: typeof release;
/**
 * Await `fn()` with the shared drain pump running. Safe to nest — multiple
 * concurrent drainRunLoop() calls share one setInterval.
 */
export declare function drainRunLoop<T>(fn: () => Promise<T>): Promise<T>;
export {};
//# sourceMappingURL=drainRunLoop.d.ts.map