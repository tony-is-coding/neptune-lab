/**
 * Tool 类型定义 — CoreTool + UITool 分离
 *
 * 将 Tool 接口拆分为核心逻辑和 UI 渲染两部分，
 * 使核心逻辑可在 non-CLI 环境使用。
 *
 * 关键决策：保持 call() 5 参数签名，确保现有 ~55 个 Tool 实现无需修改。
 *
 * 注意：此文件中的 UITool 接口使用 unknown 替代 ReactNode，
 * 以避免 engine/ 目录依赖 React。完整的 React 类型定义在 toolTypes.ui.ts 中。
 */

import type { z } from 'zod/v4'
import type { PermissionResult, ToolPermissionContext, CanUseToolFn } from './permissions.js'
import type {
  ToolResultBlockParam,
  ToolUseBlockParam,
} from '@anthropic-ai/sdk/resources/index.mjs'
import type { AssistantMessage, ProgressMessage } from './message.js'
import type { AgentDefinition } from '@claude-code-best/builtin-tools/tools/AgentTool/loadAgentsDir.js'
import type { Command } from '../commands.js'
import type { Theme, ThemeName } from '../utils/theme.js'
import type { Message } from './message.js'

// ============================================================
// JSON Schema 类型
// ============================================================

export type ToolInputJSONSchema = {
  [x: string]: unknown
  type: 'object'
  properties?: {
    [x: string]: unknown
  }
  required?: string[]
}

// ============================================================
// ToolResult — 工具执行结果
// ============================================================

/**
 * ToolResult — 工具执行结果
 */
export interface ToolResult<T = unknown> {
  type: 'result'
  resultForAssistant?: string
  data?: T
  error?: string
  newMessages?: (
    | Message
  )[]
  contextModifier?: (context: unknown) => unknown
  mcpMeta?: {
    _meta?: Record<string, unknown>
    structuredContent?: Record<string, unknown>
  }
}

// ============================================================
// ValidationResult
// ============================================================

export type ValidationResult =
  | { result: true }
  | { result: false; message: string; errorCode: number }

// ============================================================
// ToolCallProgress
// ============================================================

export interface ToolCallProgress<P = unknown> {
  toolUseID: string
  data: P
}

// ============================================================
// CoreToolContext — 核心上下文（前置声明）
// ============================================================

/**
 * CoreToolContext — 核心工具上下文
 *
 * 包含工具执行所需的核心上下文，无 UI 依赖。
 * 详细定义在 toolContext.ts 中。
 */
export interface CoreToolContext {
  // 占位，实际定义在 toolContext.ts
  [key: string]: unknown
}

// ============================================================
// CoreTool — 核心逻辑接口
// ============================================================

/**
 * CoreTool — 核心工具接口
 *
 * 包含工具的核心逻辑，可在任何环境（CLI/non-CLI）使用。
 * 注意：call() 签名保持与现有 Tool.call() 一致（5 参数），确保向后兼容。
 */
export interface CoreTool<
  I = Record<string, unknown>,
  O = unknown,
  P = unknown,
> {
  // ========== 核心标识 ==========
  /** 工具名称 */
  name: string

  /** Zod 输入 schema */
  readonly inputSchema: z.ZodType<I>

  /** JSON Schema（可选） */
  readonly inputJSONSchema?: ToolInputJSONSchema

  /** 可选别名 */
  aliases?: string[]

  /** 搜索提示 */
  searchHint?: string

  // ========== 描述 ==========
  /** 动态描述方法 */
  description(
    input: z.infer<I>,
    options: {
      isNonInteractiveSession: boolean
      toolPermissionContext: ToolPermissionContext
      tools: Tools
    },
  ): Promise<string>

  // ========== 状态检查 ==========
  isEnabled(): boolean
  isReadOnly(input: z.infer<I>): boolean
  isConcurrencySafe(input: z.infer<I>): boolean
  isDestructive?(input: z.infer<I>): boolean

  // ========== 执行 ==========
  /** 执行工具 - 保持 5 参数签名 */
  call(
    args: z.infer<I>,
    context: CoreToolContext,
    canUseTool: CanUseToolFn,
    parentMessage: AssistantMessage,
    onProgress?: ToolCallProgress<P>,
  ): Promise<ToolResult<O>>

  // ========== 权限 ==========
  checkPermissions(
    input: z.infer<I>,
    context: CoreToolContext,
  ): Promise<PermissionResult>

  validateInput?(
    input: z.infer<I>,
    context: CoreToolContext,
  ): Promise<ValidationResult>

  // ========== 其他核心方法 ==========
  outputSchema?: z.ZodType<unknown>
  inputsEquivalent?(a: z.infer<I>, b: z.infer<I>): boolean
  interruptBehavior?(): 'cancel' | 'block'
  requiresUserInteraction?(): boolean
  isMcp?: boolean
  isLsp?: boolean
  readonly shouldDefer?: boolean
  readonly alwaysLoad?: boolean
  mcpInfo?: { serverName: string; toolName: string }
  maxResultSizeChars: number
  readonly strict?: boolean
  backfillObservableInput?(input: Record<string, unknown>): void
  getPath?(input: z.infer<I>): string
  preparePermissionMatcher?(
    input: z.infer<I>,
  ): Promise<(pattern: string) => boolean>

  // ========== 提示 ==========
  prompt(options: {
    getToolPermissionContext: () => Promise<ToolPermissionContext>
    tools: Tools
    agents: AgentDefinition[]
    allowedAgentTypes?: string[]
  }): Promise<string>

  // ========== 结果映射 ==========
  mapToolResultToToolResultBlockParam(
    content: O,
    toolUseID: string,
  ): ToolResultBlockParam
}

// ============================================================
// UITool — UI 渲染接口
// ============================================================

/**
 * UITool — UI 渲染接口
 *
 * 包含工具的 UI 渲染方法，仅 CLI 环境需要实现。
 *
 * 注意：渲染方法返回类型使用 unknown 而非 ReactNode，
 * 以避免此文件依赖 React。完整的 React 类型在 toolTypes.ui.ts 中定义。
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
  ): unknown

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
  ): unknown

  renderToolUseProgressMessage?(
    progressMessages: ProgressMessage<P>[],
    options: {
      tools: Tools
      verbose: boolean
      terminalSize?: { columns: number; rows: number }
      inProgressToolCallCount?: number
      isTranscriptMode?: boolean
    },
  ): unknown

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
  ): unknown | null

  // ========== 其他 UI 方法 ==========
  toAutoClassifierInput(input: z.infer<I>): unknown
  getToolUseSummary?(input: Partial<z.infer<I>> | undefined): string | null
  getActivityDescription?(
    input: Partial<z.infer<I>> | undefined,
  ): string | null
  isTransparentWrapper?(): boolean
  isResultTruncated?(output: O): boolean
  renderToolUseTag?(input: Partial<z.infer<I>>): unknown
  renderToolUseQueuedMessage?(): unknown
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
  ): unknown
  renderToolUseErrorMessage?(
    result: ToolResultBlockParam['content'],
    options: {
      progressMessages: ProgressMessage<P>[]
      tools: Tools
      verbose: boolean
      isTranscriptMode?: boolean
    },
  ): unknown
  extractSearchText?(output: O): string
  isSearchOrReadCommand?(
    input: z.infer<I>,
  ): { isSearch: boolean; isRead: boolean; isList?: boolean }
  isOpenWorld?(input: z.infer<I>): boolean
}

// ============================================================
// Tool — 完整工具类型
// ============================================================

/**
 * Tool — 完整工具类型
 *
 * CLI 环境使用完整 Tool，包含 CoreTool + UITool。
 * non-CLI 环境只需实现 CoreTool。
 */
export type Tool<
  I = Record<string, unknown>,
  O = unknown,
  P = unknown,
> = CoreTool<I, O, P> & Partial<UITool<I, O, P>>

// ============================================================
// 工具辅助类型
// ============================================================

/** 工具输入类型提取 */
export type ToolInput<T> = T extends CoreTool<infer I, unknown, unknown>
  ? I
  : never

/** 工具输出类型提取 */
export type ToolOutput<T> = T extends CoreTool<unknown, infer O, unknown>
  ? O
  : never

/** 工具列表类型 */
export type Tools = readonly Tool[]

/** 工具映射类型 */
export type ToolMap = Map<string, Tool>
