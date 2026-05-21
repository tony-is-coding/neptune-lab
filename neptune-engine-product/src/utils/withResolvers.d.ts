/**
 * Polyfill for Promise.withResolvers() (ES2024, Node 22+).
 * package.json declares "engines": { "node": ">=18.0.0" } so we can't use the native one.
 */
export declare function withResolvers<T>(): PromiseWithResolvers<T>;
//# sourceMappingURL=withResolvers.d.ts.map