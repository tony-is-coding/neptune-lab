/**
 * Teammate mode snapshot module.
 *
 * Captures the teammate mode at session startup, following the same pattern
 * as hooksConfigSnapshot.ts. This ensures that runtime config changes don't
 * affect the teammate mode for the current session.
 */
export type TeammateMode = 'auto' | 'tmux' | 'in-process';
/**
 * Set the CLI override for teammate mode.
 * Must be called before captureTeammateModeSnapshot().
 */
export declare function setCliTeammateModeOverride(mode: TeammateMode): void;
/**
 * Get the current CLI override, if any.
 * Returns null if no CLI override was set.
 */
export declare function getCliTeammateModeOverride(): TeammateMode | null;
/**
 * Clear the CLI override and update the snapshot to the new mode.
 * Called when user changes the setting in the UI, allowing their change to take effect.
 *
 * @param newMode - The new mode the user selected (passed directly to avoid race condition)
 */
export declare function clearCliTeammateModeOverride(newMode: TeammateMode): void;
/**
 * Capture the teammate mode at session startup.
 * Called early in main.tsx, after CLI args are parsed.
 * CLI override takes precedence over config.
 */
export declare function captureTeammateModeSnapshot(): void;
/**
 * Get the teammate mode for this session.
 * Returns the snapshot captured at startup, ignoring any runtime config changes.
 */
export declare function getTeammateModeFromSnapshot(): TeammateMode;
//# sourceMappingURL=teammateModeSnapshot.d.ts.map