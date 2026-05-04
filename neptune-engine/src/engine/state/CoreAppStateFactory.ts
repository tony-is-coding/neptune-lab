/**
 * CoreAppStateFactory — 核心运行时状态工厂
 *
 * 提供 CoreAppState 的默认值创建功能。
 * 从 engine/types/CoreAppState.ts 迁移而来，遵循类型与实现分离原则。
 *
 * V18 优化：消除 value import 穿透，改为依赖注入。
 */

import type { CoreAppState } from '../types/CoreAppState.js'
import type { ToolPermissionContext } from '../../Tool.js'
import type { AttributionState } from '../../utils/commitAttribution.js'

/**
 * 创建空的 ToolPermissionContext 的函数类型
 */
export type GetEmptyToolPermissionContextFn = () => ToolPermissionContext

/**
 * 创建空的 AttributionState 的函数类型
 */
export type CreateEmptyAttributionStateFn = () => AttributionState

/**
 * CoreAppStateFactory 配置选项
 *
 * 通过依赖注入提供工厂函数，消除 value import 穿透。
 */
export interface CoreAppStateFactoryOptions {
	/**
	 * 创建空的 ToolPermissionContext 的函数
	 * 如果不提供，使用默认实现
	 */
	getEmptyToolPermissionContext?: GetEmptyToolPermissionContextFn
	/**
	 * 创建空的 AttributionState 的函数
	 * 如果不提供，使用默认实现
	 */
	createEmptyAttributionState?: CreateEmptyAttributionStateFn
}

/**
 * 创建默认的 CoreAppState
 *
 * 用于 SDK 模式下的初始化，确保所有必需字段都有合理的默认值。
 * 工厂函数通过依赖注入传入，消除 value import 穿透。
 *
 * @param options 工厂选项（可选）
 * @returns CoreAppState 实例
 */
export function createDefaultCoreAppState(
	options?: CoreAppStateFactoryOptions,
): CoreAppState {
	// 延迟导入工厂函数（仅在运行时需要时）
	// 这样可以保持模块的 value import 自由
	const getEmptyToolPermissionContext = options?.getEmptyToolPermissionContext ?? (() => {
		// 动态导入（仅在需要时）
		return require('../../Tool.js').getEmptyToolPermissionContext()
	}) as GetEmptyToolPermissionContextFn

	const createEmptyAttributionState = options?.createEmptyAttributionState ?? (() => {
		// 动态导入（仅在需要时）
		return require('../../utils/commitAttribution.js').createEmptyAttributionState()
	}) as CreateEmptyAttributionStateFn

	return {
		toolPermissionContext: getEmptyToolPermissionContext(),
		mainLoopModel: null,
		fileHistory: {
			snapshots: [],
			trackedFiles: new Set<string>(),
			snapshotSequence: 0,
		},
		attribution: createEmptyAttributionState(),
		mcp: {
			tools: [],
			clients: [],
		},
		sessionHooks: new Map(),
		fastMode: false,
		verbose: false,
		messages: [],
	}
}
