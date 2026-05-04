/**
 * CLI UI Component Registration
 *
 * This file registers all CLI-specific UI components with the framework's
 * ComponentRegistry. Called during CLI startup to establish the framework→CLI
 * dependency inversion.
 *
 * Registration categories:
 * - Dialog: Full-screen blocking dialogs (ink.render() with full tree)
 * - Inline: Components injected via setToolJSX() for mid-call display
 * - Primitive: Simple presentational components
 */

import {
  registerDialogComponent,
  registerInlineComponent,
  registerPrimitiveComponent,
} from 'claude-code-best/utils/componentRegistry.js'

// ============================================================================
// Dialog Components
// ============================================================================

/**
 * Register ManagedSettingsSecurityDialog for remote managed settings security check.
 * Used in: claude-code/src/services/remoteManagedSettings/securityCheck.tsx
 */
export async function registerManagedSettingsSecurityDialog(): Promise<void> {
  const { ManagedSettingsSecurityDialog } = await import(
    '../components/ManagedSettingsSecurityDialog/ManagedSettingsSecurityDialog.js'
  )
  registerDialogComponent('ManagedSettingsSecurityDialog', ManagedSettingsSecurityDialog)
}

/**
 * Register KeybindingSetup for keyboard binding provider.
 * Used in: claude-code/src/services/remoteManagedSettings/securityCheck.tsx
 */
export async function registerKeybindingSetup(): Promise<void> {
  const { KeybindingSetup } = await import('../keybindings/KeybindingProviderSetup.js')
  registerDialogComponent('KeybindingSetup', KeybindingSetup)
}

/**
 * Register ComputerUseApproval for computer use permission dialog.
 * Used in: claude-code/src/utils/computerUse/wrapper.tsx
 */
export async function registerComputerUseApproval(): Promise<void> {
  const { ComputerUseApproval } = await import(
    '../components/permissions/ComputerUseApproval/ComputerUseApproval.js'
  )
  registerDialogComponent('ComputerUseApproval', ComputerUseApproval)
}

// ============================================================================
// Inline Components
// ============================================================================

/**
 * Register BashModeProgress for bash mode progress display.
 * Used in: claude-code/src/utils/processUserInput/processBashCommand.tsx
 */
export async function registerBashModeProgress(): Promise<void> {
  const { BashModeProgress } = await import('../components/BashModeProgress.js')
  registerInlineComponent('BashModeProgress', BashModeProgress)
}

// ============================================================================
// Primitive Components
// ============================================================================

/**
 * Register MessageResponse for tool result message display.
 * Used in:
 * - claude-code/src/utils/claudeInChrome/toolRendering.tsx
 * - claude-code/src/utils/computerUse/toolRendering.tsx
 */
export async function registerMessageResponse(): Promise<void> {
  const { MessageResponse } = await import('../components/MessageResponse.js')
  registerPrimitiveComponent('MessageResponse', MessageResponse)
}

// ============================================================================
// Bulk Registration
// ============================================================================

/**
 * Register all CLI UI components with the framework's ComponentRegistry.
 * Call this during CLI startup before any framework code that might use these components.
 *
 * Recommended placement: Early in the CLI startup sequence, after framework init
 * but before the main REPL or command execution.
 *
 * Example:
 * ```typescript
 * import { registerAllCliComponents } from './utils/componentRegistryRegistration.js'
 *
 * async function main() {
 *   await registerAllCliComponents()
 *   // ... rest of startup
 * }
 * ```
 */
export async function registerAllCliComponents(): Promise<void> {
  // Register all dialog components
  await Promise.all([
    registerManagedSettingsSecurityDialog(),
    registerKeybindingSetup(),
    registerComputerUseApproval(),
  ])

  // Register all inline components
  await Promise.all([registerBashModeProgress()])

  // Register all primitive components
  await Promise.all([registerMessageResponse()])
}

/**
 * Get the list of registered component names for debugging.
 */
export function getRegisteredComponentNames(): {
  dialog: string[]
  inline: string[]
  primitive: string[]
} {
  const { getRegistryStatus } = require('claude-code-best/utils/componentRegistry.js')
  return getRegistryStatus()
}
