/**
 * Creates a sequential execution wrapper for async functions to prevent race conditions.
 * Ensures that concurrent calls to the wrapped function are executed one at a time
 * in the order they were received, while preserving the correct return values.
 *
 * This is useful for operations that must be performed sequentially, such as
 * file writes or database updates that could cause conflicts if executed concurrently.
 *
 * @param fn - The async function to wrap with sequential execution
 * @returns A wrapped version of the function that executes calls sequentially
 */
export declare function sequential<T extends unknown[], R>(fn: (...args: T) => Promise<R>): (...args: T) => Promise<R>;
//# sourceMappingURL=sequential.d.ts.map