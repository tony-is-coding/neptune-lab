import * as React from 'react'
import type { LocalJSXCommandContext } from 'claude-code-best/commands.js'
import { Settings } from '../../components/Settings/Settings.js'
import type { LocalJSXCommandOnDone } from 'claude-code-best/types/command.js'

export async function call(
  onDone: LocalJSXCommandOnDone,
  context: LocalJSXCommandContext,
): Promise<React.ReactNode> {
  return <Settings onClose={onDone} context={context} defaultTab="Status" />
}
