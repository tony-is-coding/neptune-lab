/**
 * engine/types/tool.ts
 *
 * Tool 类型屏障文件
 *
 * 重新导出 src/Tool.ts 的核心类型，避免 engine/ 向外穿透到 src/。
 *
 * 注意：CanUseToolFn 和 ToolPermissionContext 由 permissions.ts 屏障文件导出，
 * 此处不重复导出以避免 index.ts 的歧义冲突。
 *
 * @module
 */

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
} from '../../Tool.js'

// 重新导出函数
export {findToolByName, toolMatchesName, filterToolProgressMessages, getEmptyToolPermissionContext} from '../../Tool.js'
