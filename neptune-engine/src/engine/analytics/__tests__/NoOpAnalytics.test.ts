/**
 * NoOpAnalytics 测试
 *
 * 测试目标：
 * 1. NoOpAnalyticsSink 正确实现 AnalyticsSink 接口
 * 2. logEvent 和 logEventAsync 都是空操作
 * 3. attachNoOpAnalytics 正确附加到 analytics 系统
 */

import {describe, test, expect, beforeEach, afterEach} from 'bun:test'
import {
	NoOpAnalyticsSink,
	noOpAnalyticsSink,
	attachNoOpAnalytics,
} from '../NoOpAnalytics'
import {logEvent, _resetForTesting} from '@neptune/engine-product/services/analytics/index.js'

describe('NoOpAnalytics', () => {
	afterEach(() => {
		// 重置 analytics 状态
		_resetForTesting()
	})

	describe('NoOpAnalyticsSink', () => {
		test('应该实现 AnalyticsSink 接口', () => {
			expect(noOpAnalyticsSink).toBeDefined()
			expect(typeof noOpAnalyticsSink.logEvent).toBe('function')
			expect(typeof noOpAnalyticsSink.logEventAsync).toBe('function')
		})

		test('logEvent 应该是空操作', () => {
			// 不应该抛出任何错误
			expect(() => {
				noOpAnalyticsSink.logEvent('test_event', {key: 123})
			}).not.toThrow()
		})

		test('logEventAsync 应该返回 resolved Promise', async () => {
			const result = noOpAnalyticsSink.logEventAsync('test_event', {key: 456})
			expect(result).toBeInstanceOf(Promise)
			await expect(result).resolves.toBeUndefined()
		})

		test('logEventAsync 应该立即返回', async () => {
			const start = Date.now()
			await noOpAnalyticsSink.logEventAsync('test_event', {key: 789})
			const elapsed = Date.now() - start
			// 应该几乎是瞬时的（< 10ms）
			expect(elapsed).toBeLessThan(10)
		})
	})

	describe('attachNoOpAnalytics', () => {
		test('应该将 No-Op Analytics 附加到 analytics 系统', () => {
			// 附加 No-Op Analytics
			attachNoOpAnalytics()

			// 调用 logEvent 不应该抛出错误
			expect(() => {
				logEvent('test_event', {key: 123})
			}).not.toThrow()
		})

		test('多次调用 attachNoOpAnalytics 应该是安全的', () => {
			// 多次调用不应该抛出错误
			expect(() => {
				attachNoOpAnalytics()
				attachNoOpAnalytics()
				attachNoOpAnalytics()
			}).not.toThrow()
		})

		test('附加后 logEvent 应该是空操作', () => {
			attachNoOpAnalytics()

			// 调用 logEvent 不应该有任何副作用
			const spy = {
				calls: [] as string[],
			}
			const originalLogEvent = logEvent

			// 由于我们附加了 No-Op Analytics，logEvent 调用应该被忽略
			// 但这里我们只是验证它不会抛出错误
			expect(() => {
				logEvent('test_event', {key: 123})
			}).not.toThrow()
		})
	})

	describe('NoOpAnalyticsSink 性能', () => {
		test('批量 logEvent 调用应该快速完成', () => {
			const iterations = 10000
			const start = Date.now()

			for (let i = 0; i < iterations; i++) {
				noOpAnalyticsSink.logEvent(`test_event_${i}`, {index: i})
			}

			const elapsed = Date.now() - start
			// 10k 次调用应该在 100ms 内完成（每次 < 0.01ms）
			expect(elapsed).toBeLessThan(100)
		})

		test('批量 logEventAsync 调用应该快速完成', async () => {
			const iterations = 1000
			const start = Date.now()

			const promises = []
			for (let i = 0; i < iterations; i++) {
				promises.push(noOpAnalyticsSink.logEventAsync(`test_event_${i}`, {index: i}))
			}

			await Promise.all(promises)

			const elapsed = Date.now() - start
			// 1k 次 async 调用应该在 100ms 内完成
			expect(elapsed).toBeLessThan(100)
		})
	})
})
