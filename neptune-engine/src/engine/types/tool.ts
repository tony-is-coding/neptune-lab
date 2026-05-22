/**
 * engine/types/tool.ts
 *
 * Tool 类型屏障文件
 *
 * 重新导出 src/Tool.ts 的核心类型，避免 engine/ 向外穿透到 src/。
 * 纯类型从 product re-export；value 函数就地内联，消除反向 value import。
 *
 * 注意：CanUseToolFn 和 ToolPermissionContext 由 permissions.ts 屏障文件导出，
 * 此处不重复导出以避免 index.ts 的歧义冲突。
 *
 * @module
 */

import type {ToolPermissionContext} from './permissions.js'

// 重新导出 Tool 相关类型（不含 CanUseToolFn 和 ToolPermissionContext，它们在 permissions.ts 中）
export type {
	Tool,
	Tools,
	ToolDef,
	ToolInputJSONSchema,
	ToolUseContext,
	ToolResult,
	ToolProgress,
	ToolProgressData,
	ToolCallProgress,
} from '@neptune/engine-product/Tool.js'

// Re-export pure type helpers that have no product runtime dependency
export {findToolByName, toolMatchesName, filterToolProgressMessages} from '@neptune/engine-product/Tool.js'

// Inlined from @neptune/engine-product/Tool.js — zero-dep factory, no AppState required
export const getEmptyToolPermissionContext: () => ToolPermissionContext = () => ({
	mode: 'default',
	additionalWorkingDirectories: new Map(),
	alwaysAllowRules: {},
	alwaysDenyRules: {},
	alwaysAskRules: {},
	isBypassPermissionsModeAvailable: false,
})
