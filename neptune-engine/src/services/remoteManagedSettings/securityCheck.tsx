import React from 'react'
import { getIsInteractive } from '../../bootstrap/state.js'
import {
  getDialogComponent,
  type ComponentType,
} from '../../utils/componentRegistry.js'
import { wrappedRender as render } from '@anthropic/ink'
import { AppStateProvider } from '../../state/AppState.js'
import { gracefulShutdownSync } from '../../utils/gracefulShutdown.js'
import { getBaseRenderOptions } from '../../utils/renderOptions.js'
import type { SettingsJson } from '../../utils/settings/types.js'
import { logEvent } from '../analytics/index.js'

// ============================================================================
// Utility Functions (originally from utils.js)
// ============================================================================

/**
 * Extract dangerous settings from settings JSON.
 * Inlined here to avoid CLI dependency. CLI version should be moved to framework.
 */
function extractDangerousSettings(settings: SettingsJson): Record<string, unknown> {
  const dangerous: Record<string, unknown> = {}
  if (!settings) return dangerous

  const DANGEROUS_PATTERNS = [
    'dangerouslyAllowFetch',
    'dangerouslyDisableBrowserSecurity',
    'dangerouslyAllowSelfSigned',
    'dangerouslyDisableLocalStorage',
    'dangerouslyAllowShell',
    'dangerouslyDisableAppStore',
  ]

  for (const key of DANGEROUS_PATTERNS) {
    if (key in settings && settings[key as keyof SettingsJson] !== undefined) {
      dangerous[key] = settings[key as keyof SettingsJson]
    }
  }

  return dangerous
}

/**
 * Check if settings contain dangerous configurations.
 */
function hasDangerousSettings(dangerous: Record<string, unknown>): boolean {
  return Object.keys(dangerous).length > 0
}

/**
 * Check if dangerous settings have changed between two settings objects.
 */
function hasDangerousSettingsChanged(
  cached: SettingsJson | null,
  current: SettingsJson | null,
): boolean {
  const cachedDangerous = cached ? extractDangerousSettings(cached) : {}
  const currentDangerous = current ? extractDangerousSettings(current) : {}

  const cachedKeys = Object.keys(cachedDangerous).sort()
  const currentKeys = Object.keys(currentDangerous).sort()

  // Keys changed
  if (JSON.stringify(cachedKeys) !== JSON.stringify(currentKeys)) {
    return true
  }

  // Values changed
  for (const key of cachedKeys) {
    if (cachedDangerous[key] !== currentDangerous[key]) {
      return true
    }
  }

  return false
}

export type SecurityCheckResult = 'approved' | 'rejected' | 'no_check_needed'

/**
 * Check if new remote managed settings contain dangerous settings that require user approval.
 * Shows a blocking dialog if dangerous settings have changed or been added.
 *
 * @param cachedSettings The current cached settings (may be null for first run)
 * @param newSettings The new settings fetched from the API
 * @returns 'approved' if user accepts, 'rejected' if user declines, 'no_check_needed' if no dangerous changes
 */
export async function checkManagedSettingsSecurity(
  cachedSettings: SettingsJson | null,
  newSettings: SettingsJson | null,
): Promise<SecurityCheckResult> {
  // If new settings don't have dangerous settings, no check needed
  if (
    !newSettings ||
    !hasDangerousSettings(extractDangerousSettings(newSettings))
  ) {
    return 'no_check_needed'
  }

  // If dangerous settings haven't changed, no check needed
  if (!hasDangerousSettingsChanged(cachedSettings, newSettings)) {
    return 'no_check_needed'
  }

  // Skip dialog in non-interactive mode (consistent with trust dialog behavior)
  if (!getIsInteractive()) {
    return 'no_check_needed'
  }

  // Log that dialog is being shown
  logEvent('tengu_managed_settings_security_dialog_shown', {})

  // Get dialog components from registry (registered by CLI at startup)
  const ManagedSettingsSecurityDialog = getDialogComponent('ManagedSettingsSecurityDialog')
  const KeybindingSetup = getDialogComponent('KeybindingSetup')

  // If components not registered (SDK/headless mode), skip dialog
  if (!ManagedSettingsSecurityDialog || !KeybindingSetup) {
    return 'no_check_needed'
  }

  // Show blocking dialog
  return new Promise<SecurityCheckResult>(resolve => {
    void (async () => {
      const { unmount } = await render(
        <AppStateProvider>
          <KeybindingSetup>
            <ManagedSettingsSecurityDialog
              settings={newSettings}
              onAccept={() => {
                logEvent('tengu_managed_settings_security_dialog_accepted', {})
                unmount()
                void resolve('approved')
              }}
              onReject={() => {
                logEvent('tengu_managed_settings_security_dialog_rejected', {})
                unmount()
                void resolve('rejected')
              }}
            />
          </KeybindingSetup>
        </AppStateProvider>,
        getBaseRenderOptions(false),
      )
    })()
  })
}

/**
 * Handle the security check result by exiting if rejected
 * Returns true if we should continue, false if we should stop
 */
export function handleSecurityCheckResult(
  result: SecurityCheckResult,
): boolean {
  if (result === 'rejected') {
    gracefulShutdownSync(1)
    return false
  }
  return true
}
