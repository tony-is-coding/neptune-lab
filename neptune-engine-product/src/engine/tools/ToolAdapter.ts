/**
 * ToolAdapter — Tool 适配器
 *
 * 支持 CoreTool 和完整 Tool 之间的互转，
 * 使 non-CLI 环境可以使用 CoreTool。
 *
 * **保留理由**：
 * - 这是一个通用工具，虽然当前框架内部没有直接使用它，
 * - 但它提供了在 CLI 和 non-CLI 环境之间转换 Tool 的能力，
 * - 可能被外部使用者引用。因此保留此文件。
 *
 * **使用场景**：
 * - SDK 用户需要在非 CLI 环境中使用 CoreTool
 * - 将 CLI 工具转换为 SDK 工具
 * - 在不同环境间共享工具定义
 */

import type {Tool, CoreTool, UITool, Tools} from '../../types/toolTypes.js'

/**
 * 从完整 Tool 提取 CoreTool
 *
 * 用于 CLI 环境的 Tool 在 non-CLI 环境中使用。
 * 丢弃 UI 相关方法。
 */
export function toolToCoreTool<
	I = Record<string, unknown>,
	O = unknown,
	P = unknown,
>(tool: Tool<I, O, P>): CoreTool<I, O, P> {
	// 提取核心方法，排除 UI 方法
	const {
		userFacingName,
		userFacingNameBackgroundColor,
		renderToolUseMessage,
		renderToolResultMessage,
		renderToolUseProgressMessage,
		renderGroupedToolUse,
		isTransparentWrapper,
		getToolUseSummary,
		getActivityDescription,
		toAutoClassifierInput,
		isResultTruncated,
		renderToolUseTag,
		renderToolUseQueuedMessage,
		renderToolUseRejectedMessage,
		renderToolUseErrorMessage,
		extractSearchText,
		isSearchOrReadCommand,
		isOpenWorld,
		...coreTool
	} = tool as Tool<I, O, P> & Partial<UITool<I, O, P>>

	return coreTool as CoreTool<I, O, P>
}

/**
 * 将 CoreTool 转换为完整 Tool
 *
 * 用于 non-CLI 环境的 CoreTool 在 CLI 环境中使用。
 * UI 方法使用默认实现。
 */
export function coreToolToTool<
	I = Record<string, unknown>,
	O = unknown,
	P = unknown,
>(
	coreTool: CoreTool<I, O, P>,
	uiDefaults?: Partial<UITool<I, O, P>>,
): Tool<I, O, P> {
	return {
		...coreTool,
		// UI 方法默认实现
		userFacingName: uiDefaults?.userFacingName ?? (() => coreTool.name),
		toAutoClassifierInput: uiDefaults?.toAutoClassifierInput ?? (() => ''),
		renderToolUseMessage:
			uiDefaults?.renderToolUseMessage ?? (() => null as unknown),
		...uiDefaults,
	} as Tool<I, O, P>
}

/**
 * 检查 Tool 是否实现了 UITool 方法
 */
export function hasUIImplementation<
	I = Record<string, unknown>,
	O = unknown,
>(tool: Tool<I, O>): boolean {
	return (
		tool.renderToolUseMessage !== undefined ||
		tool.renderToolResultMessage !== undefined
	)
}

/**
 * 过滤工具列表，只返回 CoreTool
 */
export function filterToCoreTools(tools: Tools): CoreTool[] {
	return tools.map(toolToCoreTool)
}
