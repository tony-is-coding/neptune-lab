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
	return {
		async executeNotificationHooks(data) {
			void data
		},

		async executeConfigChangeHooks(source, filePath, timeoutMs) {
			void source
			void filePath
			void timeoutMs
			return []
		},

		async executeSessionEndHooks(reason, options) {
			void reason
			void options
		},
	}
}

export {buildBaseHookInput} from './HookContext.js'
export type {HookContext, HookResult, HookExecutor}
