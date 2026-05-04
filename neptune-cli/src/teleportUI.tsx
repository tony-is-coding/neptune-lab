/**
 * CLI-side teleport UI functions.
 * Extracted from framework teleport.tsx to eliminate framework→CLI reverse dependency.
 */
import type { Root } from '@anthropic/ink'
import React from 'react'
import { KeybindingSetup } from './keybindings/KeybindingProviderSetup.js'
import {
  getTeleportErrors,
  TeleportError,
  type TeleportLocalErrorType,
} from './components/TeleportError.js'
import { AppStateProvider } from 'claude-code-best/state/AppState.js'
import {
  teleportToRemote,
  type TeleportToRemoteResponse,
} from 'claude-code-best/utils/teleport.js'

async function handleTeleportPrerequisites(
  root: Root,
  errorsToIgnore?: Set<TeleportLocalErrorType>,
): Promise<void> {
  const errors = await getTeleportErrors()
  if (errors.size > 0) {
    await new Promise<void>(resolve => {
      root.render(
        <AppStateProvider>
          <KeybindingSetup>
            <TeleportError
              errorsToIgnore={errorsToIgnore}
              onComplete={() => {
                void resolve()
              }}
            />
          </KeybindingSetup>
        </AppStateProvider>,
      )
    })
  }
}

export async function teleportToRemoteWithErrorHandling(
  root: Root,
  description: string | null,
  signal: AbortSignal,
  branchName?: string,
): Promise<TeleportToRemoteResponse | null> {
  const errorsToIgnore = new Set<TeleportLocalErrorType>(['needsGitStash'])
  await handleTeleportPrerequisites(root, errorsToIgnore)
  return teleportToRemote({
    initialMessage: description,
    signal,
    branchName,
    onBundleFail: msg => process.stderr.write(`\n${msg}\n`),
  })
}
