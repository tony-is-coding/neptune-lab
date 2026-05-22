/**
 * engine/types/tool.ts
 *
 * Tool 核心类型 — engine-local definitions
 *
 * 完全内联，消除对 @neptune/engine-product/Tool.js 的反向依赖。
 * Tool 类型使用 opaque 最小接口，函数实现直接内联。
 */

import type {ToolPermissionContext} from './permissions.js'

// ============================================================
// 基础类型
// ============================================================

export type ToolInputJSONSchema = {
	[x: string]: unknown
	type: 'object'
	properties?: {
		[x: string]: unknown
	}
}

/** Tool progress 数据基类 */
export type ToolProgressData = {
	type: string
	[key: string]: unknown
}

/** Tool progress 消息 */
export type ToolProgress<P extends ToolProgressData = ToolProgressData> = {
	data: P
	[key: string]: unknown
}

/** Tool call progress callback */
export type ToolCallProgress<P extends ToolProgressData = ToolProgressData> = (
	progress: ToolProgress<P>,
) => void

/** ToolUseContext — engine 最小接口 */
export type ToolUseContext = {
	[key: string]: unknown
}

/** ToolResult — engine 最小接口 */
export type ToolResult<T = unknown> = {
	data: T
	newMessages?: unknown[]
	contextModifier?: (context: ToolUseContext) => ToolUseContext
	mcpMeta?: {
		_meta?: Record<string, unknown>
		structuredContent?: Record<string, unknown>
	}
}

// ============================================================
// Tool 定义类型
// ============================================================

/** ToolDef — engine 最小接口 */
export type ToolDef<I = Record<string, unknown>> = {
	name: string
	description: string
	inputSchema?: ToolInputJSONSchema
	aliases?: string[]
	[key: string]: unknown
}

/** CoreTool — 无 UI 方法的工具接口 */
export type CoreTool<
	I = Record<string, unknown>,
	O = unknown,
	P = unknown,
> = {
	name: string
	description: string
	aliases?: string[]
	inputSchema?: ToolInputJSONSchema
	call?: (input: I, context: ToolUseContext, progress: ToolCallProgress) => Promise<ToolResult<O>>
	[key: string]: unknown
}

/** UITool — UI 渲染方法接口 */
export type UITool<
	I = Record<string, unknown>,
	O = unknown,
	P = unknown,
> = {
	userFacingName?: (input: I) => string
	userFacingNameBackgroundColor?: string
	renderToolUseMessage?: (input: I, context: unknown) => unknown
	renderToolResultMessage?: (output: O, input: I, context: unknown) => unknown
	renderToolUseProgressMessage?: (progress: ToolProgress, input: I) => unknown
	renderGroupedToolUse?: (inputs: I[], context: unknown) => unknown
	isTransparentWrapper?: boolean
	getToolUseSummary?: (input: I, output: O) => string
	getActivityDescription?: (input: I) => string
	toAutoClassifierInput?: (input: I) => string
	isResultTruncated?: (output: O) => boolean
	renderToolUseTag?: (input: I) => unknown
	renderToolUseQueuedMessage?: (input: I) => unknown
	renderToolUseRejectedMessage?: (input: I) => unknown
	renderToolUseErrorMessage?: (input: I, error: Error) => unknown
	extractSearchText?: (input: I) => string | undefined
	isSearchOrReadCommand?: boolean
	isOpenWorld?: boolean
}

/** Tool — 完整工具类型（CoreTool + UITool） */
export type Tool<
	I = Record<string, unknown>,
	O = unknown,
	P = unknown,
> = CoreTool<I, O, P> & Partial<UITool<I, O, P>>

/** Tools — 工具列表 */
export type Tools = Tool[]

/** ToolRegistry — 工具注册表接口 */
export type ToolRegistry = {
	getTools(): Tools
	getTool(name: string): Tool | undefined
	[key: string]: unknown
}

// ============================================================
// Progress 消息类型
// ============================================================

export type ProgressMessage<T = unknown> = {
	data: T
	[key: string]: unknown
}

// ============================================================
// 内联函数实现（来自 @neptune/engine-product/Tool.js）
// ============================================================

/**
 * Checks if a tool matches the given name (primary name or alias).
 */
export function toolMatchesName(
	tool: { name: string; aliases?: string[] },
	name: string,
): boolean {
	return tool.name === name || (tool.aliases?.includes(name) ?? false)
}

/**
 * Finds a tool by name or alias from a list of tools.
 */
export function findToolByName(tools: Tools, name: string): Tool | undefined {
	return tools.find(t => toolMatchesName(t, name))
}

/**
 * Filters progress messages to only tool progress (excludes hook_progress).
 */
export function filterToolProgressMessages(
	progressMessagesForMessage: ProgressMessage[],
): ProgressMessage<ToolProgressData>[] {
	return progressMessagesForMessage.filter(
		(msg): msg is ProgressMessage<ToolProgressData> =>
			(msg.data as { type?: string })?.type !== 'hook_progress',
	)
}

// ============================================================
// getEmptyToolPermissionContext — zero-dep factory
// ============================================================

export const getEmptyToolPermissionContext: () => ToolPermissionContext = () => ({
	mode: 'default',
	additionalWorkingDirectories: new Map(),
	alwaysAllowRules: {},
	alwaysDenyRules: {},
	alwaysAskRules: {},
	isBypassPermissionsModeAvailable: false,
})
