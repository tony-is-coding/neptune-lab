import * as React from 'react'
import type { LocalJSXCommandContext } from 'claude-code-best/commands.js'
import type { LocalJSXCommandOnDone } from 'claude-code-best/types/command.js'
import type { AppState } from 'claude-code-best/state/AppState.js'

/** Stub — install wizard is not yet restored. */
export async function computeDefaultInstallDir(): Promise<string> {
  return ''
}

/** Stub — install wizard is not yet restored. */
export function NewInstallWizard(_props: {
  defaultDir: string
  onInstalled: (dir: string) => void
  onCancel: () => void
  onError: (message: string) => void
}): React.ReactNode {
  return null
}

/**
 * /assistant command implementation.
 *
 * Opens the Kairos assistant panel. In the current build the panel is
 * rendered by the REPL layer when kairosActive is true; the slash command
 * simply toggles visibility and prints a confirmation line.
 */
export async function call(
  onDone: LocalJSXCommandOnDone,
  context: LocalJSXCommandContext,
  _args: string,
): Promise<React.ReactNode> {
  const { setAppState, getAppState } = context

  const current = getAppState()
  const isVisible = (current as Record<string, unknown>).assistantPanelVisible

  if (isVisible) {
    setAppState((prev: AppState) => ({
      ...prev,
      assistantPanelVisible: false,
    } as AppState))
    onDone('Assistant panel hidden.', { display: 'system' })
  } else {
    setAppState((prev: AppState) => ({
      ...prev,
      assistantPanelVisible: true,
    } as AppState))
    onDone('Assistant panel opened.', { display: 'system' })
  }

  return null
}
