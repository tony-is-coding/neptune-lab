/**
 * Analytics 接口 + NoOpAnalytics 默认实现 单测
 *
 * 目的：固化 substrate 提供的轻量 Analytics 抽象。
 * - 接口仅有 logEvent(name, data?)，零依赖
 * - NoOpAnalytics 默认实现：所有调用静默吞，return void
 * - 通过 ToolUseContext.analytics 注入；未注入时 ctx.analytics?.logEvent 静默跳过
 *
 * 这是 Stage 1.1 的 TDD 红色起点 —— 实现还没写，测试期望先固化。
 */

import {describe, expect, it} from 'bun:test'
import {NoOpAnalytics, type Analytics} from '../Analytics.js'

describe('Analytics interface', () => {
	it('NoOpAnalytics.logEvent 不抛错', () => {
		const a = new NoOpAnalytics()
		expect(() => a.logEvent('any_event')).not.toThrow()
	})

	it('NoOpAnalytics.logEvent 接受 metadata 不抛错', () => {
		const a = new NoOpAnalytics()
		expect(() =>
			a.logEvent('event_with_meta', {model: 'claude-sonnet-4', tokens: 1234}),
		).not.toThrow()
	})

	it('NoOpAnalytics.logEvent 返回 void', () => {
		const a = new NoOpAnalytics()
		const result = a.logEvent('event')
		expect(result).toBeUndefined()
	})

	it('NoOpAnalytics.logEvent 接受 null/undefined data 不抛错', () => {
		const a = new NoOpAnalytics()
		expect(() => a.logEvent('event', undefined)).not.toThrow()
		expect(() =>
			a.logEvent('event', null as unknown as Record<string, unknown>),
		).not.toThrow()
	})

	it('Analytics 接口可注入到 ToolUseContext.analytics 字段', () => {
		// 这是结构化 typing 测试 —— 任意符合接口的对象都能赋值
		const customAnalytics: Analytics = {
			logEvent(name, data) {
				void name
				void data
			},
		}
		const ctx: {analytics?: Analytics} = {analytics: customAnalytics}
		expect(ctx.analytics).toBe(customAnalytics)
		expect(() => ctx.analytics?.logEvent('test')).not.toThrow()
	})
})
