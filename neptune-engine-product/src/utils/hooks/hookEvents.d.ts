/**
 * Hook event system for broadcasting hook execution events.
 *
 * This module provides a generic event system that is separate from the
 * main message stream. Handlers can register to receive events and decide
 * what to do with them (e.g., convert to SDK messages, log, etc.).
 */
export type HookStartedEvent = {
    type: 'started';
    hookId: string;
    hookName: string;
    hookEvent: string;
};
export type HookProgressEvent = {
    type: 'progress';
    hookId: string;
    hookName: string;
    hookEvent: string;
    stdout: string;
    stderr: string;
    output: string;
};
export type HookResponseEvent = {
    type: 'response';
    hookId: string;
    hookName: string;
    hookEvent: string;
    output: string;
    stdout: string;
    stderr: string;
    exitCode?: number;
    outcome: 'success' | 'error' | 'cancelled';
};
export type HookExecutionEvent = HookStartedEvent | HookProgressEvent | HookResponseEvent;
export type HookEventHandler = (event: HookExecutionEvent) => void;
export declare function registerHookEventHandler(handler: HookEventHandler | null): void;
export declare function emitHookStarted(hookId: string, hookName: string, hookEvent: string): void;
export declare function emitHookProgress(data: {
    hookId: string;
    hookName: string;
    hookEvent: string;
    stdout: string;
    stderr: string;
    output: string;
}): void;
export declare function startHookProgressInterval(params: {
    hookId: string;
    hookName: string;
    hookEvent: string;
    getOutput: () => Promise<{
        stdout: string;
        stderr: string;
        output: string;
    }>;
    intervalMs?: number;
}): () => void;
export declare function emitHookResponse(data: {
    hookId: string;
    hookName: string;
    hookEvent: string;
    output: string;
    stdout: string;
    stderr: string;
    exitCode?: number;
    outcome: 'success' | 'error' | 'cancelled';
}): void;
/**
 * Enable emission of all hook event types (beyond SessionStart and Setup).
 * Called when the SDK `includeHookEvents` option is set or when running
 * in CLAUDE_CODE_REMOTE mode.
 */
export declare function setAllHookEventsEnabled(enabled: boolean): void;
export declare function clearHookEventState(): void;
//# sourceMappingURL=hookEvents.d.ts.map