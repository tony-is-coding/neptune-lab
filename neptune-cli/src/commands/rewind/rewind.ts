import type { LocalCommandResult } from 'claude-code-best/commands.js'
import type { ToolUseContext } from 'claude-code-best/Tool.js'

export async function call(
  _args: string,
  context: ToolUseContext,
): Promise<LocalCommandResult> {
  if (context.openMessageSelector) {
    context.openMessageSelector()
  }
  // Return a skip message to not append any messages.
  return { type: 'skip' }
}
