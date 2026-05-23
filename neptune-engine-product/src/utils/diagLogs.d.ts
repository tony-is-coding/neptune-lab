type DiagnosticLogLevel = 'debug' | 'info' | 'warn' | 'error';
/**
 * Logs diagnostic information to a logfile. This information is sent
 * via the environment manager to session-ingress to monitor issues from
 * within the container.
 *
 * *Important* - this function MUST NOT be called with any PII, including
 * file paths, project names, repo names, prompts, etc.
 *
 * @param level    Log level. Only used for information, not filtering
 * @param event    A specific event: "started", "mcp_connected", etc.
 * @param data     Optional additional data to log
 */
export declare function logForDiagnosticsNoPII(level: DiagnosticLogLevel, event: string, data?: Record<string, unknown>): void;
/**
 * Wraps an async function with diagnostic timing logs.
 * Logs `{event}_started` before execution and `{event}_completed` after with duration_ms.
 *
 * @param event   Event name prefix (e.g., "git_status" -> logs "git_status_started" and "git_status_completed")
 * @param fn      Async function to execute and time
 * @param getData Optional function to extract additional data from the result for the completion log
 * @returns       The result of the wrapped function
 */
export declare function withDiagnosticsTiming<T>(event: string, fn: () => Promise<T>, getData?: (result: T) => Record<string, unknown>): Promise<T>;
export {};
//# sourceMappingURL=diagLogs.d.ts.map