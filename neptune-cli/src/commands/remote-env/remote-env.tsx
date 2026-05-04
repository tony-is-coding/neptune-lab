import * as React from 'react'
import { RemoteEnvironmentDialog } from '../../components/RemoteEnvironmentDialog.js'
import type { LocalJSXCommandOnDone } from 'claude-code-best/types/command.js'

export async function call(
  onDone: LocalJSXCommandOnDone,
): Promise<React.ReactNode> {
  return <RemoteEnvironmentDialog onDone={onDone} />
}
