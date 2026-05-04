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

import type React from 'react'

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Any React component type. Framework doesn't depend on React directly
 * for type safety - this is opaque to the framework.
 */
export type ComponentType = React.ComponentType<any>

// ============================================================================
// Dialog Components (ink.render() with full render tree)
// ============================================================================

const dialogComponents = new Map<string, ComponentType>()

/**
 * Register a dialog component (called by CLI at startup).
 * Dialog components are rendered via ink.render() with their own render tree.
 *
 * Examples:
 * - ManagedSettingsSecurityDialog
 * - KeybindingSetup
 * - ComputerUseApproval
 */
export function registerDialogComponent(name: string, component: ComponentType): void {
  dialogComponents.set(name, component)
}

/**
 * Get a registered dialog component.
 * Returns undefined if not registered (e.g., in SDK/headless mode).
 *
 * Callers should handle undefined gracefully:
 * - Skip dialog rendering
 * - Return default 'no_check_needed' result
 * - Fail-safe to non-interactive behavior
 */
export function getDialogComponent(name: string): ComponentType | undefined {
  return dialogComponents.get(name)
}

// ============================================================================
// Inline Components (setToolJSX() injection)
// ============================================================================

const inlineComponents = new Map<string, ComponentType>()

/**
 * Register an inline component (called by CLI at startup).
 * Inline components are injected via setToolJSX() for mid-call display.
 *
 * Examples:
 * - BashModeProgress
 */
export function registerInlineComponent(name: string, component: ComponentType): void {
  inlineComponents.set(name, component)
}

/**
 * Get a registered inline component.
 * Returns undefined if not registered (e.g., in SDK/headless mode).
 */
export function getInlineComponent(name: string): ComponentType | undefined {
  return inlineComponents.get(name)
}

// ============================================================================
// Primitive Components (presentational only)
// ============================================================================

const primitiveComponents = new Map<string, ComponentType>()

/**
 * Register a primitive component (called by CLI at startup).
 * Primitive components are simple presentational components.
 *
 * Examples:
 * - MessageResponse
 */
export function registerPrimitiveComponent(name: string, component: ComponentType): void {
  primitiveComponents.set(name, component)
}

/**
 * Get a registered primitive component.
 * Returns undefined if not registered (e.g., in SDK/headless mode).
 */
export function getPrimitiveComponent(name: string): ComponentType | undefined {
  return primitiveComponents.get(name)
}

// ============================================================================
// Type Definitions (for type-only imports)
// ============================================================================

/**
 * Register a type definition for framework use.
 * Used when framework only needs the type, not the component itself.
 *
 * Examples:
 * - SuggestionItem (from PromptInputFooterSuggestions)
 */
const typeDefinitions = new Map<string, unknown>()

export function registerTypeDefinition(name: string, type: unknown): void {
  typeDefinitions.set(name, type)
}

export function getTypeDefinition(name: string): unknown | undefined {
  return typeDefinitions.get(name)
}

// ============================================================================
// Registry Management (for testing/cleanup)
// ============================================================================

/**
 * Clear all registered components.
 * Primarily used for testing.
 */
export function clearAllRegistry(): void {
  dialogComponents.clear()
  inlineComponents.clear()
  primitiveComponents.clear()
  typeDefinitions.clear()
}

/**
 * Get registration status for debugging.
 */
export function getRegistryStatus(): {
  dialog: string[]
  inline: string[]
  primitive: string[]
  types: string[]
} {
  return {
    dialog: Array.from(dialogComponents.keys()),
    inline: Array.from(inlineComponents.keys()),
    primitive: Array.from(primitiveComponents.keys()),
    types: Array.from(typeDefinitions.keys()),
  }
}
