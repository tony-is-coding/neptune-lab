import type { HooksSettings } from '../settings/types.js';
/**
 * Check if only managed hooks should run.
 * This is true when:
 * - policySettings has allowManagedHooksOnly: true, OR
 * - disableAllHooks is set in non-managed settings (non-managed settings
 *   cannot disable managed hooks, so they effectively become managed-only)
 */
export declare function shouldAllowManagedHooksOnly(): boolean;
/**
 * Check if all hooks (including managed) should be disabled.
 * This is only true when managed/policy settings has disableAllHooks: true.
 * When disableAllHooks is set in non-managed settings, managed hooks still run.
 */
export declare function shouldDisableAllHooksIncludingManaged(): boolean;
/**
 * Capture a snapshot of the current hooks configuration
 * This should be called once during application startup
 * Respects the allowManagedHooksOnly setting
 */
export declare function captureHooksConfigSnapshot(): void;
/**
 * Update the hooks configuration snapshot
 * This should be called when hooks are modified through the settings
 * Respects the allowManagedHooksOnly setting
 */
export declare function updateHooksConfigSnapshot(): void;
/**
 * Get the current hooks configuration from snapshot
 * Falls back to settings if no snapshot exists
 * @returns The hooks configuration
 */
export declare function getHooksConfigFromSnapshot(): HooksSettings | null;
/**
 * Reset the hooks configuration snapshot (useful for testing)
 * Also resets SDK init state to prevent test pollution
 */
export declare function resetHooksConfigSnapshot(): void;
//# sourceMappingURL=hooksConfigSnapshot.d.ts.map