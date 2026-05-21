/**
 * UI Component Registry for framework→CLI decoupling.
 *
 * Framework core provides registration points for UI components
 * that CLI registers at startup. This eliminates framework→CLI dependency.
 *
 * Component Categories:
 * - Dialog: Full-screen blocking dialogs rendered via ink.render()
 * - Inline: Components injected via setToolJSX() for mid-call display
 * - Primitive: Simple presentational components (wrappers, tags, etc.)
 *
 * Registration pattern:
 * 1. Framework exports register*Component() functions
 * 2. CLI calls them at startup with actual React components
 * 3. Framework code calls get*Component() to retrieve registered components
 * 4. In SDK/headless mode, get*Component() returns undefined (graceful degradation)
 */
import type React from 'react';
/**
 * Any React component type. Framework doesn't depend on React directly
 * for type safety - this is opaque to the framework.
 */
export type ComponentType = React.ComponentType<any>;
/**
 * Register a dialog component (called by CLI at startup).
 * Dialog components are rendered via ink.render() with their own render tree.
 *
 * Examples:
 * - ManagedSettingsSecurityDialog
 * - KeybindingSetup
 * - ComputerUseApproval
 */
export declare function registerDialogComponent(name: string, component: ComponentType): void;
/**
 * Get a registered dialog component.
 * Returns undefined if not registered (e.g., in SDK/headless mode).
 *
 * Callers should handle undefined gracefully:
 * - Skip dialog rendering
 * - Return default 'no_check_needed' result
 * - Fail-safe to non-interactive behavior
 */
export declare function getDialogComponent(name: string): ComponentType | undefined;
/**
 * Register an inline component (called by CLI at startup).
 * Inline components are injected via setToolJSX() for mid-call display.
 *
 * Examples:
 * - BashModeProgress
 */
export declare function registerInlineComponent(name: string, component: ComponentType): void;
/**
 * Get a registered inline component.
 * Returns undefined if not registered (e.g., in SDK/headless mode).
 */
export declare function getInlineComponent(name: string): ComponentType | undefined;
/**
 * Register a primitive component (called by CLI at startup).
 * Primitive components are simple presentational components.
 *
 * Examples:
 * - MessageResponse
 */
export declare function registerPrimitiveComponent(name: string, component: ComponentType): void;
/**
 * Get a registered primitive component.
 * Returns undefined if not registered (e.g., in SDK/headless mode).
 */
export declare function getPrimitiveComponent(name: string): ComponentType | undefined;
export declare function registerTypeDefinition(name: string, type: unknown): void;
export declare function getTypeDefinition(name: string): unknown | undefined;
/**
 * Clear all registered components.
 * Primarily used for testing.
 */
export declare function clearAllRegistry(): void;
/**
 * Get registration status for debugging.
 */
export declare function getRegistryStatus(): {
    dialog: string[];
    inline: string[];
    primitive: string[];
    types: string[];
};
//# sourceMappingURL=componentRegistry.d.ts.map