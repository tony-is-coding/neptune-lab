import { relative } from 'path'
import type { ToolUseContext } from 'claude-code-best/Tool.js'
import type { LocalCommandResult } from 'claude-code-best/types/command.js'
import { getCwd } from 'claude-code-best/utils/cwd.js'
import { cacheKeys } from 'claude-code-best/utils/fileStateCache.js'

export async function call(
  _args: string,
  context: ToolUseContext,
): Promise<LocalCommandResult> {
  const files = context.readFileState ? cacheKeys(context.readFileState) : []

  if (files.length === 0) {
    return { type: 'text' as const, value: 'No files in context' }
  }

  const fileList = files.map(file => relative(getCwd(), file)).join('\n')
  return { type: 'text' as const, value: `Files in context:\n${fileList}` }
}
