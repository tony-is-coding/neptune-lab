/**
 * HookCore — Hook 核心执行模块
 *
 * 提供 headless/SDK/server 模式下的 Hook 执行能力。
 * 包装原始 hooks.ts 的 execute 函数，提供零 UI 依赖的公共 API。
 *
 * 设计原则：
 * - 不物理移动 hooks.ts 的代码，仅包装调用
 * - 零 React 依赖（通过动态 require 延迟加载）
 * - 向后兼容
 */
import type {HookContext, HookResult, HookExecutor} from './HookContext.js'

/**
 * 创建 HookCore 实例
 *
 * 在 headless/SDK 模式下使用：
 * ```typescript
 * const hookCore = createHookCore({
 *   sessionId: 'session-1',
 *   projectRoot: '/path/to/project',
 *   isNonInteractive: true,
 * })
 *
 * // 执行通知 Hook
 * await hookCore.executeNotificationHooks({
 *   message: '任务完成',
 *   notificationType: 'info',
 * })
 *
 * // 执行配置变更 Hook
 * const results = await hookCore.executeConfigChangeHooks('settings')
 * ```
 */
export function createHookCore(_ctx: HookContext): HookExecutor {
	// 动态 require 确保 HookCore 模块本身零 React 依赖
	// 实际调用时通过 require 委托到原始 hooks.ts
	const loadHooks = () => {
		return require('../../utils/hooks.js') as typeof import('../../utils/hooks.js')
	}

	return {
		async executeNotificationHooks(data) {
			const hooks = loadHooks()
			await hooks.executeNotificationHooks(data)
		},

		async executeConfigChangeHooks(source, filePath, timeoutMs) {
			const hooks = loadHooks()
			const results = await hooks.executeConfigChangeHooks(
				source as any,
				filePath,
				timeoutMs,
			)
			return results.map(mapResult)
		},

		async executeSessionEndHooks(reason, options) {
			const hooks = loadHooks()
			await hooks.executeSessionEndHooks(
				reason as any,
				options as any,
			)
		},
	}
}

/**
 * 将原始 HookOutsideReplResult 映射为 HookResult
 */
function mapResult(result: {
	succeeded: boolean
	output?: string
	command?: string
}): HookResult {
	return {
		succeeded: result.succeeded,
		output: result.output,
		command: result.command,
	}
}

export {buildBaseHookInput} from './HookContext.js'
export type {HookContext, HookResult, HookExecutor}
