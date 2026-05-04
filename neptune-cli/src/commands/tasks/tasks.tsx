import * as React from 'react'
import type { LocalJSXCommandContext } from 'claude-code-best/commands.js'
import { BackgroundTasksDialog } from '../../components/tasks/BackgroundTasksDialog.js'
import type { LocalJSXCommandOnDone } from 'claude-code-best/types/command.js'

export async function call(
  onDone: LocalJSXCommandOnDone,
  context: LocalJSXCommandContext,
): Promise<React.ReactNode> {
  return <BackgroundTasksDialog toolUseContext={context} onDone={onDone} />
}
