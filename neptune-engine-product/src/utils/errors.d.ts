export declare class ClaudeError extends Error {
    constructor(message: string);
}
export declare class MalformedCommandError extends Error {
}
export declare class AbortError extends Error {
    constructor(message?: string);
}
/**
 * True iff `e` is any of the abort-shaped errors the codebase encounters:
 * our AbortError class, a DOMException from AbortController.abort()
 * (.name === 'AbortError'), or the SDK's APIUserAbortError. The SDK class
 * is checked via instanceof because minified builds mangle class names —
 * constructor.name becomes something like 'nJT' and the SDK never sets
 * this.name, so string matching silently fails in production.
 */
export declare function isAbortError(e: unknown): boolean;
/**
 * Custom error class for configuration file parsing errors
 * Includes the file path and the default configuration that should be used
 */
export declare class ConfigParseError extends Error {
    filePath: string;
    defaultConfig: unknown;
    constructor(message: string, filePath: string, defaultConfig: unknown);
}
export declare class ShellError extends Error {
    readonly stdout: string;
    readonly stderr: string;
    readonly code: number;
    readonly interrupted: boolean;
    constructor(stdout: string, stderr: string, code: number, interrupted: boolean);
}
export declare class TeleportOperationError extends Error {
    readonly formattedMessage: string;
    constructor(message: string, formattedMessage: string);
}
/**
 * Error with a message that is safe to log to telemetry.
 * Use the long name to confirm you've verified the message contains no
 * sensitive data (file paths, URLs, code snippets).
 *
 * Single-arg: same message for user and telemetry
 * Two-arg: different messages (e.g., full message has file path, telemetry doesn't)
 *
 * @example
 * // Same message for both
 * throw new TelemetrySafeError_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS(
 *   'MCP server "slack" connection timed out'
 * )
 *
 * // Different messages
 * throw new TelemetrySafeError_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS(
 *   `MCP tool timed out after ${ms}ms`,  // Full message for logs/user
 *   'MCP tool timed out'                  // Telemetry message
 * )
 */
export declare class TelemetrySafeError_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS extends Error {
    readonly telemetryMessage: string;
    constructor(message: string, telemetryMessage?: string);
}
export declare function hasExactErrorMessage(error: unknown, message: string): boolean;
/**
 * Normalize an unknown value into an Error.
 * Use at catch-site boundaries when you need an Error instance.
 */
export declare function toError(e: unknown): Error;
/**
 * Extract a string message from an unknown error-like value.
 * Use when you only need the message (e.g., for logging or display).
 */
export declare function errorMessage(e: unknown): string;
/**
 * Extract the errno code (e.g., 'ENOENT', 'EACCES') from a caught error.
 * Returns undefined if the error has no code or is not an ErrnoException.
 * Replaces the `(e as NodeJS.ErrnoException).code` cast pattern.
 */
export declare function getErrnoCode(e: unknown): string | undefined;
/**
 * True if the error is ENOENT (file or directory does not exist).
 * Replaces `(e as NodeJS.ErrnoException).code === 'ENOENT'`.
 */
export declare function isENOENT(e: unknown): boolean;
/**
 * Extract the errno path (the filesystem path that triggered the error)
 * from a caught error. Returns undefined if the error has no path.
 * Replaces the `(e as NodeJS.ErrnoException).path` cast pattern.
 */
export declare function getErrnoPath(e: unknown): string | undefined;
/**
 * Extract error message + top N stack frames from an unknown error.
 * Use when the error flows to the model as a tool_result — full stack
 * traces are ~500-2000 chars of mostly-irrelevant internal frames and
 * waste context tokens. Keep the full stack in debug logs instead.
 */
export declare function shortErrorStack(e: unknown, maxFrames?: number): string;
/**
 * True if the error means the path is missing, inaccessible, or
 * structurally unreachable — use in catch blocks after fs operations to
 * distinguish expected "nothing there / no access" from unexpected errors.
 *
 * Covers:
 *  ENOENT    — path does not exist
 *  EACCES    — permission denied
 *  EPERM     — operation not permitted
 *  ENOTDIR   — a path component is not a directory (e.g. a file named
 *              `.claude` exists where a directory is expected)
 *  ELOOP     — too many symlink levels (circular symlinks)
 */
export declare function isFsInaccessible(e: unknown): e is NodeJS.ErrnoException;
export type AxiosErrorKind = 'auth' | 'timeout' | 'network' | 'http' | 'other';
/**
 * Classify a caught error from an axios request into one of a few buckets.
 * Replaces the ~20-line isAxiosError → 401/403 → ECONNABORTED → ECONNREFUSED
 * chain duplicated across sync-style services (settingsSync, policyLimits,
 * remoteManagedSettings, teamMemorySync).
 *
 * Checks the `.isAxiosError` marker property directly (same as
 * axios.isAxiosError()) to keep this module dependency-free.
 */
export declare function classifyAxiosError(e: unknown): {
    kind: AxiosErrorKind;
    status?: number;
    message: string;
};
//# sourceMappingURL=errors.d.ts.map