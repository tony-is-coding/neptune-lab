/**
 * bridge/extensions.ts — substrate 仍对外暴露的两个扩展类型
 *
 * v6.0 P0.2.C：原 OriginalQueryEngineBridge.ts 已一刀切删除（旧 provider 双轨 +
 * buildQueryEngineConfig + initializeRuntime / adaptToolExtension 助手全部清理），
 * ToolExtension / PermissionConfig 是 product 仍在使用的两个 SDK 类型，单独搬到
 * 这里以保持最小依赖（不再 import bridge 内部任何旧路径符号）。
 */

import type {PermissionDelegate} from '../permissions/PermissionDelegate.js'

/** 用户自定义工具扩展 */
export interface ToolExtension {
	name: string
	description: string
	inputSchema: {
		type: 'object'
		properties: Record<string, unknown>
	}
	execute: (params: Record<string, unknown>) => Promise<{ content: string }>
}

/** 权限配置选项 */
export interface PermissionConfig {
	/** 是否绕过权限检查（用于 headless/自动化场景） */
	bypassPermissions?: boolean
	/** 可编程的权限决策委托（中间路径） */
	delegate?: PermissionDelegate
}
