/**
 * ReviewArtifactTool UI 渲染方法
 *
 * 将 UI 渲染逻辑从主工具文件中分离出来，
 * 使核心工具文件不含 React/Ink 依赖。
 */

import * as React from 'react'
import { Box, Text } from '@anthropic/ink'
import type { Output } from './ReviewArtifactTool.js'

/**
 * 渲染工具使用消息
 */
export function renderToolUseMessage(
  input: Partial<{ title?: string; annotations?: Array<{ line?: number; message: string; severity?: string }> }>,
  { verbose }: { theme?: string; verbose: boolean },
): React.ReactNode {
  const title = input.title ?? 'Untitled artifact'
  const count = input.annotations?.length ?? 0
  if (verbose) {
    return `Review: "${title}" (${count} annotation(s))`
  }
  return title
}

/**
 * 渲染工具结果消息
 */
export function renderToolResultMessage(
  output: Output,
  _progressMessages: unknown[],
  { verbose }: { verbose: boolean },
): React.ReactNode {
  if (verbose) {
    return React.createElement(
      Box,
      { flexDirection: 'column' },
      React.createElement(
        Text,
        null,
        `Reviewed artifact: ${output.title ?? 'Untitled'} (${output.annotationCount} annotations)`,
      ),
      output.summary
        ? React.createElement(Text, { dimColor: true }, output.summary)
        : null,
    )
  }
  return React.createElement(
    Text,
    null,
    `Review complete: ${output.annotationCount} annotation(s)`,
  )
}
