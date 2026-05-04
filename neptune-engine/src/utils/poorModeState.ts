/**
 * Poor mode state - shared between framework and CLI
 */
let poorModeActive: boolean | null = null

export function isPoorModeActive(): boolean {
  if (poorModeActive === null) {
    // Lazy import to avoid circular deps
    const { getInitialSettings } = require('./settings/settings.js') as typeof import('./settings/settings.js')
    poorModeActive = getInitialSettings().poorMode === true
  }
  return poorModeActive
}

export function setPoorModeActive(value: boolean): void {
  poorModeActive = value
}
