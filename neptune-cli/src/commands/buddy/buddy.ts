// buddy command implementation disabled — buddy feature removed from framework core
// All buddy-related imports from claude-code/src/buddy/ are no longer available

import React from 'react'
import type { ToolUseContext } from 'claude-code-best/Tool.js'
import type {
  LocalJSXCommandContext,
  LocalJSXCommandOnDone,
} from 'claude-code-best/types/command.js'

export async function call(
  onDone: LocalJSXCommandOnDone,
  context: ToolUseContext & LocalJSXCommandContext,
  args: string,
): Promise<React.ReactNode> {
  onDone('buddy feature has been removed from framework core', { display: 'system' })
  return null
}
