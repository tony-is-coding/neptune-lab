import { type SettingSource } from './constants.js';
/**
 * Initialize file watching
 */
export declare function initialize(): Promise<void>;
/**
 * Clean up file watcher. Returns a promise that resolves when chokidar's
 * close() settles — callers that need the watcher fully stopped before
 * removing the watched directory (e.g. test teardown) must await this.
 * Fire-and-forget is still valid where timing doesn't matter.
 */
export declare function dispose(): Promise<void>;
/**
 * Subscribe to settings changes
 */
export declare const subscribe: (listener: (source: "userSettings" | "projectSettings" | "localSettings" | "flagSettings" | "policySettings") => void) => () => void;
/**
 * Manually notify listeners of a settings change.
 * Used for programmatic settings changes (e.g., remote managed settings refresh)
 * that don't involve file system changes.
 */
export declare function notifyChange(source: SettingSource): void;
/**
 * Reset internal state for testing purposes only.
 * This allows re-initialization after dispose().
 * Optionally accepts timing overrides for faster test execution.
 *
 * Closes the watcher and returns the close promise so preload's afterEach
 * can await it BEFORE nuking perTestSettingsDir. Without this, chokidar's
 * pending awaitWriteFinish poll fires on the deleted dir → ENOENT (#25253).
 */
export declare function resetForTesting(overrides?: {
    stabilityThreshold?: number;
    pollInterval?: number;
    mdmPollInterval?: number;
    deletionGrace?: number;
}): Promise<void>;
export declare const settingsChangeDetector: {
    initialize: typeof initialize;
    dispose: typeof dispose;
    subscribe: (listener: (source: "userSettings" | "projectSettings" | "localSettings" | "flagSettings" | "policySettings") => void) => () => void;
    notifyChange: typeof notifyChange;
    resetForTesting: typeof resetForTesting;
};
//# sourceMappingURL=changeDetector.d.ts.map