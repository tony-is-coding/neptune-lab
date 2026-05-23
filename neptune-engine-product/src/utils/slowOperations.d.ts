import type { WriteFileOptions } from 'fs';
type WriteFileOptionsWithFlush = WriteFileOptions | (WriteFileOptions & {
    flush?: boolean;
});
/**
 * Threshold in milliseconds for logging slow JSON/clone operations.
 * Operations taking longer than this will be logged for debugging.
 * - Override: set CLAUDE_CODE_SLOW_OPERATION_THRESHOLD_MS to a number
 * - Dev builds: 20ms (lower threshold for development)
 * - Ants: 300ms (enabled for all internal users)
 */
declare const SLOW_OPERATION_THRESHOLD_MS: number;
export { SLOW_OPERATION_THRESHOLD_MS };
/**
 * Extract the first stack frame outside this file, so the DevBar warning
 * points at the actual caller instead of a useless `Object{N keys}`.
 * Only called when an operation was actually slow — never on the fast path.
 */
export declare function callerFrame(stack: string | undefined): string;
/**
 * Tagged template for slow operation logging.
 *
 * In ANT builds: creates an AntSlowLogger that times the operation and logs
 * if it exceeds the threshold. Description is built lazily only when slow.
 *
 * In external builds: returns a singleton no-op disposable. Zero allocations,
 * zero timing. AntSlowLogger and buildDescription are dead-code-eliminated.
 *
 * @example
 * using _ = slowLogging`structuredClone(${value})`
 * const result = structuredClone(value)
 */
export declare const slowLogging: {
    (strings: TemplateStringsArray, ...values: unknown[]): Disposable;
};
/**
 * Wrapped JSON.stringify with slow operation logging.
 * Use this instead of JSON.stringify directly to detect performance issues.
 *
 * @example
 * import { jsonStringify } from './slowOperations.js'
 * const json = jsonStringify(data)
 * const prettyJson = jsonStringify(data, null, 2)
 */
export declare function jsonStringify(value: unknown, replacer?: (this: unknown, key: string, value: unknown) => unknown, space?: string | number): string;
export declare function jsonStringify(value: unknown, replacer?: (number | string)[] | null, space?: string | number): string;
/**
 * Wrapped JSON.parse with slow operation logging.
 * Use this instead of JSON.parse directly to detect performance issues.
 *
 * @example
 * import { jsonParse } from './slowOperations.js'
 * const data = jsonParse(jsonString)
 */
export declare const jsonParse: typeof JSON.parse;
/**
 * Wrapped structuredClone with slow operation logging.
 * Use this instead of structuredClone directly to detect performance issues.
 *
 * @example
 * import { clone } from './slowOperations.js'
 * const copy = clone(originalObject)
 */
export declare function clone<T>(value: T, options?: StructuredSerializeOptions): T;
/**
 * Wrapped cloneDeep with slow operation logging.
 * Use this instead of lodash cloneDeep directly to detect performance issues.
 *
 * @example
 * import { cloneDeep } from './slowOperations.js'
 * const copy = cloneDeep(originalObject)
 */
export declare function cloneDeep<T>(value: T): T;
/**
 * Wrapper around fs.writeFileSync with slow operation logging.
 * Supports flush option to ensure data is written to disk before returning.
 * @param filePath The path to the file to write to
 * @param data The data to write (string or Buffer)
 * @param options Optional write options (encoding, mode, flag, flush)
 * @deprecated Use `fs.promises.writeFile` instead for non-blocking writes.
 * Sync file writes block the event loop and cause performance issues.
 */
export declare function writeFileSync_DEPRECATED(filePath: string, data: string | NodeJS.ArrayBufferView, options?: WriteFileOptionsWithFlush): void;
//# sourceMappingURL=slowOperations.d.ts.map