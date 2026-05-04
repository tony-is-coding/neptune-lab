import * as React from 'react'
import type { LocalJSXCommandContext } from 'claude-code-best/commands.js'
import { SkillsMenu } from '../../components/skills/SkillsMenu.js'
import type { LocalJSXCommandOnDone } from 'claude-code-best/types/command.js'

export async function call(
  onDone: LocalJSXCommandOnDone,
  context: LocalJSXCommandContext,
): Promise<React.ReactNode> {
  return <SkillsMenu onExit={onDone} commands={context.options.commands} />
}
