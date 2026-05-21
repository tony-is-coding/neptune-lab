import { type HookEvent } from 'src/entrypoints/agentSdkTypes.js';
import type { AppState } from 'src/state/AppState.js';
import type { Message } from 'src/types/message.js';
import type { AggregatedHookResult } from '../hooks.js';
import type { HookCommand } from '../settings/types.js';
type OnHookSuccess = (hook: HookCommand | FunctionHook, result: AggregatedHookResult) => void;
/** Function hook callback - returns true if check passes, false to block */
export type FunctionHookCallback = (messages: Message[], signal?: AbortSignal) => boolean | Promise<boolean>;
/**
 * Function hook type with callback embedded.
 * Session-scoped only, cannot be persisted to settings.json.
 */
export type FunctionHook = {
    type: 'function';
    id?: string;
    timeout?: number;
    callback: FunctionHookCallback;
    errorMessage: string;
    statusMessage?: string;
};
type SessionHookMatcher = {
    matcher: string;
    skillRoot?: string;
    hooks: Array<{
        hook: HookCommand | FunctionHook;
        onHookSuccess?: OnHookSuccess;
    }>;
};
export type SessionStore = {
    hooks: {
        [event in HookEvent]?: SessionHookMatcher[];
    };
};
/**
 * Map (not Record) so .set/.delete don't change the container's identity.
 * Mutator functions mutate the Map and return prev unchanged, letting
 * store.ts's Object.is(next, prev) check short-circuit and skip listener
 * notification. Session hooks are ephemeral per-agent runtime callbacks,
 * never reactively read (only getAppState() snapshots in the query loop).
 * Same pattern as agentControllers on LocalWorkflowTaskState.
 *
 * This matters under high-concurrency workflows: parallel() with N
 * schema-mode agents fires N addFunctionHook calls in one synchronous
 * tick. With a Record + spread, each call cost O(N) to copy the growing
 * map (O(N²) total) plus fired all ~30 store listeners. With Map: .set()
 * is O(1), return prev means zero listener fires.
 */
export type SessionHooksState = Map<string, SessionStore>;
/**
 * Add a command or prompt hook to the session.
 * Session hooks are temporary, in-memory only, and cleared when session ends.
 */
export declare function addSessionHook(setAppState: (updater: (prev: AppState) => AppState) => void, sessionId: string, event: HookEvent, matcher: string, hook: HookCommand, onHookSuccess?: OnHookSuccess, skillRoot?: string): void;
/**
 * Add a function hook to the session.
 * Function hooks execute TypeScript callbacks in-memory for validation.
 * @returns The hook ID (for removal)
 */
export declare function addFunctionHook(setAppState: (updater: (prev: AppState) => AppState) => void, sessionId: string, event: HookEvent, matcher: string, callback: FunctionHookCallback, errorMessage: string, options?: {
    timeout?: number;
    id?: string;
}): string;
/**
 * Remove a function hook by ID from the session.
 */
export declare function removeFunctionHook(setAppState: (updater: (prev: AppState) => AppState) => void, sessionId: string, event: HookEvent, hookId: string): void;
/**
 * Remove a specific hook from the session
 * @param setAppState The function to update the app state
 * @param sessionId The session ID
 * @param event The hook event
 * @param hook The hook command to remove
 */
export declare function removeSessionHook(setAppState: (updater: (prev: AppState) => AppState) => void, sessionId: string, event: HookEvent, hook: HookCommand): void;
export type SessionDerivedHookMatcher = {
    matcher: string;
    hooks: HookCommand[];
    skillRoot?: string;
};
/**
 * Get all session hooks for a specific event (excluding function hooks)
 * @param appState The app state
 * @param sessionId The session ID
 * @param event Optional event to filter by
 * @returns Hook matchers for the event, or all hooks if no event specified
 */
export declare function getSessionHooks(appState: AppState, sessionId: string, event?: HookEvent): Map<HookEvent, SessionDerivedHookMatcher[]>;
type FunctionHookMatcher = {
    matcher: string;
    hooks: FunctionHook[];
};
/**
 * Get all session function hooks for a specific event
 * Function hooks are kept separate because they can't be persisted to HookMatcher format.
 * @param appState The app state
 * @param sessionId The session ID
 * @param event Optional event to filter by
 * @returns Function hook matchers for the event
 */
export declare function getSessionFunctionHooks(appState: AppState, sessionId: string, event?: HookEvent): Map<HookEvent, FunctionHookMatcher[]>;
/**
 * Get the full hook entry (including callbacks) for a specific session hook
 */
export declare function getSessionHookCallback(appState: AppState, sessionId: string, event: HookEvent, matcher: string, hook: HookCommand | FunctionHook): {
    hook: HookCommand | FunctionHook;
    onHookSuccess?: OnHookSuccess;
} | undefined;
/**
 * Clear all session hooks for a specific session
 * @param setAppState The function to update the app state
 * @param sessionId The session ID
 */
export declare function clearSessionHooks(setAppState: (updater: (prev: AppState) => AppState) => void, sessionId: string): void;
export {};
//# sourceMappingURL=sessionHooks.d.ts.map