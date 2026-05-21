/**
 * UI Component Registry for swarm/teammate features.
 *
 * Framework core provides registration points for UI components
 * that CLI registers at startup. This eliminates framework→CLI dependency.
 */

import type React from 'react'

type It2SetupPromptProps = {
	onDone: (result: 'installed' | 'use-tmux' | 'cancelled') => void
	tmuxAvailable: boolean
}

type It2SetupPromptComponent = React.ComponentType<It2SetupPromptProps>

let registeredIt2SetupPrompt: It2SetupPromptComponent | null = null

/**
 * Register the It2SetupPrompt component (called by CLI at startup)
 */
export function registerIt2SetupPrompt(
	component: It2SetupPromptComponent,
): void {
	registeredIt2SetupPrompt = component
}

/**
 * Get the registered It2SetupPrompt component
 * Returns null if not registered (e.g., in SDK/headless mode)
 */
export function getIt2SetupPrompt(): It2SetupPromptComponent | null {
	return registeredIt2SetupPrompt
}
