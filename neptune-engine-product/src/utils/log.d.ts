import type { BetaMessageStreamParams } from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs';
import type { QuerySource } from 'src/constants/querySource.js';
import { type LogOption } from '../types/logs.js';
/**
 * Gets the display title for a log/session with fallback logic.
 * Skips firstPrompt if it starts with a tick/goal tag (autonomous mode auto-prompt).
 * Strips display-unfriendly tags (like <ide_opened_file>) from the result.
 * Falls back to a truncated session ID when no other title is available.
 */
export declare function getLogDisplayTitle(log: LogOption, defaultTitle?: string): string;
export declare function dateToFilename(date: Date): string;
/**
 * Sink interface for the error logging backend
 */
export type ErrorLogSink = {
    logError: (error: Error) => void;
    logMCPError: (serverName: string, error: unknown) => void;
    logMCPDebug: (serverName: string, message: string) => void;
    getErrorsPath: () => string;
    getMCPLogsPath: (serverName: string) => string;
};
/**
 * Attach the error log sink that will receive all error events.
 * Queued events are drained immediately to ensure no errors are lost.
 *
 * Idempotent: if a sink is already attached, this is a no-op. This allows
 * calling from both the preAction hook (for subcommands) and setup() (for
 * the default command) without coordination.
 */
export declare function attachErrorLogSink(newSink: ErrorLogSink): void;
export declare function logError(error: unknown): void;
export declare function getInMemoryErrors(): {
    error: string;
    timestamp: string;
}[];
/**
 * Loads the list of error logs
 * @returns List of error logs sorted by date
 */
export declare function loadErrorLogs(): Promise<LogOption[]>;
/**
 * Gets an error log by its index
 * @param index Index in the sorted list of logs (0-based)
 * @returns Log data or null if not found
 */
export declare function getErrorLogByIndex(index: number): Promise<LogOption | null>;
export declare function logMCPError(serverName: string, error: unknown): void;
export declare function logMCPDebug(serverName: string, message: string): void;
/**
 * Captures the last API request for inclusion in bug reports.
 */
export declare function captureAPIRequest(params: BetaMessageStreamParams, querySource?: QuerySource): void;
/**
 * Reset error log state for testing purposes only.
 * @internal
 */
export declare function _resetErrorLogForTesting(): void;
//# sourceMappingURL=log.d.ts.map