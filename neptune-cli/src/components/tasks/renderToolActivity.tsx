import React from 'react'
import { Text } from '@anthropic/ink'
import type { Tools } from 'claude-code-best/Tool.js'
import { findToolByName } from 'claude-code-best/Tool.js'
import type { ToolActivity } from 'claude-code-best/tasks/LocalAgentTask/LocalAgentTask.js'
import type { ThemeName } from 'claude-code-best/utils/theme.js'

export function renderToolActivity(
  activity: ToolActivity,
  tools: Tools,
  theme: ThemeName,
): React.ReactNode {
  const tool = findToolByName(tools, activity.toolName)
  if (!tool) {
    return activity.toolName
  }
  try {
    const parsed = tool.inputSchema.safeParse(activity.input)
    const parsedInput = parsed.success ? parsed.data : {}
    const userFacingName = tool.userFacingName(parsedInput)
    if (!userFacingName) {
      return activity.toolName
    }
    const toolArgs = tool.renderToolUseMessage(parsedInput, {
      theme,
      verbose: false,
    }) as React.ReactNode
    if (toolArgs) {
      return (
        <Text>
          {userFacingName}({toolArgs})
        </Text>
      )
    }
    return userFacingName
  } catch {
    return activity.toolName
  }
}
