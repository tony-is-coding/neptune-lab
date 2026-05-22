/**
 * engine/analytics/NoOpAnalytics.ts
 *
 * No-Op Analytics 实现
 *
 * 用于 SDK 模式下，消除核心路径的 analytics 开销。
 * 所有方法都是空操作，零性能开销。
 */

import type {AnalyticsSink} from '@neptune/engine-product/services/analytics/index.js'

/**
 * No-Op Analytics Sink
 *
 * 实现 AnalyticsSink 接口，但所有操作都是空操作。
 * 用于 SDK 模式或测试环境，消除 analytics 开销。
 */
export class NoOpAnalyticsSink implements AnalyticsSink {
	/**
	 * 空操作的 logEvent
	 *
	 * @param _eventName - 事件名称（忽略）
	 * @param _metadata - 事件元数据（忽略）
	 */
	logEvent(_eventName: string, _metadata: Record<string, boolean | number | undefined>): void {
		// No-op
	}

	/**
	 * 空操作的 logEventAsync
	 *
	 * @param _eventName - 事件名称（忽略）
	 * @param _metadata - 事件元数据（忽略）
	 * @returns 立即 resolve 的 Promise
	 */
	async logEventAsync(
		_eventName: string,
		_metadata: Record<string, boolean | number | undefined>,
	): Promise<void> {
		// No-op
		return
	}
}

/**
 * 单例 No-Op Analytics Sink 实例
 */
export const noOpAnalyticsSink = new NoOpAnalyticsSink()

/**
 * 便捷函数：将 No-Op Analytics 附加到 analytics 系统
 *
 * 调用后，所有 analytics 调用都会被忽略，不会有任何性能开销。
 *
 * @example
 * ```ts
 * import { attachNoOpAnalytics } from './engine/analytics/index.js'
 *
 * // SDK 模式下使用 No-Op Analytics
 * attachNoOpAnalytics()
 * ```
 */
export function attachNoOpAnalytics(): void {
	const {attachAnalyticsSink} = require('@neptune/engine-product/services/analytics/index.js')
	attachAnalyticsSink(noOpAnalyticsSink)
}
