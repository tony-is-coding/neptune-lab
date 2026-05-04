/**
 * MonitorTool UI 渲染方法
 *
 * 将 UI 渲染逻辑从主工具文件中分离出来，
 * 使核心工具文件不含 React/Ink 依赖。
 */

import * as React from 'react'
import { Text } from '@anthropic/ink'
import { truncate } from 'src/utils/format.js'
import type { MonitorInput, MonitorOutput } from './MonitorTool.js'

/**
 * 渲染工具使用消息
 */
export function renderToolUseMessage(
  input: MonitorInput,
  { verbose }: { verbose: boolean },
): React.ReactNode {
  const desc = truncate(input.description || input.command, 80)
  return `Monitor: ${desc}`
}

/**
 * 渲染工具结果消息
 */
export function renderToolResultMessage(output: MonitorOutput): React.ReactNode {
  return <Text>Monitor started (task {output.taskId}). Output: {output.outputFile}</Text>
}
