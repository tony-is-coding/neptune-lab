/**
 * NoOpAnalytics 测试
 */

import {describe, test, expect} from 'bun:test'
import {
	NoOpAnalyticsSink,
	noOpAnalyticsSink,
	attachNoOpAnalytics,
} from '../NoOpAnalytics'

describe('NoOpAnalytics', () => {
	describe('NoOpAnalyticsSink', () => {
		test('应该实现 AnalyticsSink 接口', () => {
			expect(noOpAnalyticsSink).toBeDefined()
			expect(typeof noOpAnalyticsSink.logEvent).toBe('function')
			expect(typeof noOpAnalyticsSink.logEventAsync).toBe('function')
		})

		test('logEvent 应该是空操作', () => {
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
			expect(elapsed).toBeLessThan(10)
		})
	})

	describe('attachNoOpAnalytics', () => {
		test('attachNoOpAnalytics 不应该抛出错误', () => {
			expect(() => {
				attachNoOpAnalytics()
			}).not.toThrow()
		})

		test('多次调用 attachNoOpAnalytics 应该是安全的', () => {
			expect(() => {
				attachNoOpAnalytics()
				attachNoOpAnalytics()
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
			expect(elapsed).toBeLessThan(100)
		})
	})
})
