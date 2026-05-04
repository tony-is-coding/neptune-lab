/**
 * Tool 类型 UI 扩展 — CLI 环境专用
 *
 * 此文件包含完整的 React 类型定义，仅供 CLI 环境使用。
 * SDK/non-CLI 环境应使用 toolTypes.ts 中的核心类型（ReactNode 替换为 unknown）。
 *
 * 从 toolTypes.ts 重新导出所有类型，并覆盖 UITool 的渲染方法返回类型为 ReactNode。
 */

import type { ReactNode } from 'react'
import type { z } from 'zod/v4'

// 从 toolTypes.ts 导入核心类型到本地作用域（供 UITool 接口使用）
import type {
  ToolInputJSONSchema,
  ToolResult,
  ValidationResult,
  ToolCallProgress,
  CoreToolContext,
  CoreTool,
  UITool as CoreUITool,
  Tool,
  ToolInput,
  ToolOutput,
  Tools,
  ToolMap,
} from './toolTypes.js'

// 重新导出，供外部使用
export type {
  ToolInputJSONSchema,
  ToolResult,
  ValidationResult,
  ToolCallProgress,
  CoreToolContext,
  CoreTool,
  Tool,
  ToolInput,
  ToolOutput,
  Tools,
  ToolMap,
}

// 重新定义完整的 UITool 接口（包含 ReactNode）
import type {
  ToolResultBlockParam,
  ToolUseBlockParam,
} from '@anthropic-ai/sdk/resources/index.mjs'
import type { ProgressMessage } from './message.js'
import type { Command } from '../commands.js'
import type { Theme, ThemeName } from '../utils/theme.js'
import type { Message } from './message.js'

/**
 * UITool — UI 渲染接口（完整 React 版本）
 *
 * 包含工具的 UI 渲染方法，仅 CLI 环境需要实现。
 * 渲染方法返回类型为 ReactNode。
 */
export interface UITool<
  I = Record<string, unknown>,
  O = unknown,
  P = unknown,
> {
  // ========== 用户友好名称 ==========
  userFacingName(input: Partial<z.infer<I>> | undefined): string
  userFacingNameBackgroundColor?(
    input: Partial<z.infer<I>> | undefined,
  ): keyof Theme | undefined

  // ========== 渲染方法 ==========
  renderToolUseMessage(
    input: Partial<z.infer<I>>,
    options: { theme: ThemeName; verbose: boolean; commands?: Command[] },
  ): ReactNode

  renderToolResultMessage?(
    content: O,
    progressMessages: ProgressMessage<P>[],
    options: {
      style?: 'condensed'
      theme: ThemeName
      tools: Tools
      verbose: boolean
      isTranscriptMode?: boolean
      isBriefOnly?: boolean
      input?: unknown
    },
  ): ReactNode

  renderToolUseProgressMessage?(
    progressMessages: ProgressMessage<P>[],
    options: {
      tools: Tools
      verbose: boolean
      terminalSize?: { columns: number; rows: number }
      inProgressToolCallCount?: number
      isTranscriptMode?: boolean
    },
  ): ReactNode

  renderGroupedToolUse?(
    toolUses: Array<{
      param: ToolUseBlockParam
      isResolved: boolean
      isError: boolean
      isInProgress: boolean
      progressMessages: ProgressMessage<P>[]
      result?: { param: ToolResultBlockParam; output: unknown }
    }>,
    options: { shouldAnimate: boolean; tools: Tools },
  ): ReactNode | null

  // ========== 其他 UI 方法 ==========
  toAutoClassifierInput(input: z.infer<I>): unknown
  getToolUseSummary?(input: Partial<z.infer<I>> | undefined): string | null
  getActivityDescription?(
    input: Partial<z.infer<I>> | undefined,
  ): string | null
  isTransparentWrapper?(): boolean
  isResultTruncated?(output: O): boolean
  renderToolUseTag?(input: Partial<z.infer<I>>): ReactNode
  renderToolUseQueuedMessage?(): ReactNode
  renderToolUseRejectedMessage?(
    input: z.infer<I>,
    options: {
      columns: number
      messages: Message[]
      style?: 'condensed'
      theme: ThemeName
      tools: Tools
      verbose: boolean
      progressMessages: ProgressMessage<P>[]
      isTranscriptMode?: boolean
    },
  ): ReactNode
  renderToolUseErrorMessage?(
    result: ToolResultBlockParam['content'],
    options: {
      progressMessages: ProgressMessage<P>[]
      tools: Tools
      verbose: boolean
      isTranscriptMode?: boolean
    },
  ): ReactNode
  extractSearchText?(output: O): string
  isSearchOrReadCommand?(
    input: z.infer<I>,
  ): { isSearch: boolean; isRead: boolean; isList?: boolean }
  isOpenWorld?(input: z.infer<I>): boolean
}

/**
 * ToolWithUI — 完整工具类型（包含 React UI）
 *
 * CLI 环境使用此类型，包含 CoreTool + UITool（ReactNode 版本）。
 */
export type ToolWithUI<
  I = Record<string, unknown>,
  O = unknown,
  P = unknown,
> = CoreTool<I, O, P> & Partial<UITool<I, O, P>>
