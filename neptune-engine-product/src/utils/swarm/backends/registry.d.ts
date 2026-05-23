import type { BackendDetectionResult, PaneBackend, PaneBackendType, TeammateExecutor } from './types.js';
/**
 * Ensures backend classes are dynamically imported so getBackendByType() can
 * construct them. Unlike detectAndGetBackend(), this never spawns subprocesses
 * and never throws — it's the lightweight option when you only need class
 * registration (e.g., killing a pane by its stored backendType).
 */
export declare function ensureBackendsRegistered(): Promise<void>;
/**
 * Registers the TmuxBackend class with the registry.
 * Called by TmuxBackend.ts to avoid circular dependencies.
 */
export declare function registerTmuxBackend(backendClass: new () => PaneBackend): void;
/**
 * Registers the ITermBackend class with the registry.
 * Called by ITermBackend.ts to avoid circular dependencies.
 */
export declare function registerITermBackend(backendClass: new () => PaneBackend): void;
/**
 * Detection priority flow:
 * 1. If inside tmux, always use tmux (even in iTerm2)
 * 2. If in iTerm2 with it2 available, use iTerm2 backend
 * 3. If in iTerm2 without it2, return result indicating setup needed
 * 4. If tmux available, use tmux (creates external session)
 * 5. Otherwise, throw error with instructions
 */
export declare function detectAndGetBackend(): Promise<BackendDetectionResult>;
/**
 * Gets a backend by explicit type selection.
 * Useful for testing or when the user has a preference.
 *
 * @param type - The backend type to get
 * @returns The requested backend instance
 * @throws If the requested backend type is not available
 */
export declare function getBackendByType(type: PaneBackendType): PaneBackend;
/**
 * Gets the currently cached backend, if any.
 * Returns null if no backend has been detected yet.
 */
export declare function getCachedBackend(): PaneBackend | null;
/**
 * Gets the cached backend detection result, if any.
 * Returns null if detection hasn't run yet.
 * Use `isNative` to check if teammates are visible in native panes.
 */
export declare function getCachedDetectionResult(): BackendDetectionResult | null;
/**
 * Records that spawn fell back to in-process mode because no pane backend
 * was available. After this, isInProcessEnabled() returns true and subsequent
 * spawns short-circuit to in-process (the environment won't change mid-session).
 */
export declare function markInProcessFallback(): void;
/**
 * Checks if in-process teammate execution is enabled.
 *
 * Logic:
 * - If teammateMode is 'in-process', always enabled
 * - If teammateMode is 'tmux', always disabled (use pane backend)
 * - If teammateMode is 'auto' (default), check environment:
 *   - If inside tmux, use pane backend (return false)
 *   - If inside iTerm2, use pane backend (return false) - detectAndGetBackend()
 *     will pick ITermBackend if it2 is available, or fall back to tmux
 *   - Otherwise, use in-process (return true)
 */
export declare function isInProcessEnabled(): boolean;
/**
 * Returns the resolved teammate executor mode for this session.
 * Unlike getTeammateModeFromSnapshot which may return 'auto', this returns
 * what 'auto' actually resolves to given the current environment.
 */
export declare function getResolvedTeammateMode(): 'in-process' | 'tmux';
/**
 * Gets the InProcessBackend instance.
 * Creates and caches the instance on first call.
 */
export declare function getInProcessBackend(): TeammateExecutor;
/**
 * Gets a TeammateExecutor for spawning teammates.
 *
 * Returns either:
 * - InProcessBackend when preferInProcess is true and in-process mode is enabled
 * - PaneBackendExecutor wrapping the detected pane backend otherwise
 *
 * This provides a unified TeammateExecutor interface regardless of execution mode,
 * allowing callers to spawn and manage teammates without knowing the backend details.
 *
 * @param preferInProcess - If true and in-process is enabled, returns InProcessBackend.
 *                          Otherwise returns PaneBackendExecutor.
 * @returns TeammateExecutor instance
 */
export declare function getTeammateExecutor(preferInProcess?: boolean): Promise<TeammateExecutor>;
/**
 * Resets the backend detection cache.
 * Used for testing to allow re-detection.
 */
export declare function resetBackendDetection(): void;
//# sourceMappingURL=registry.d.ts.map