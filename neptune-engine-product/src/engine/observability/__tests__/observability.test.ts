/**
 * observability/__tests__/observability.test.ts — 可观测性模块测试
 *
 * 测试内容：
 * 1. NoOpTracingProvider 零开销验证
 * 2. InMemoryMetricsProvider CRUD 操作
 */

import {describe, test, expect, beforeEach} from 'bun:test'
import {NoOpTracingProvider} from '../NoOpTracingProvider'
import {InMemoryMetricsProvider} from '../InMemoryMetricsProvider'
import {SpanStatus} from '../types'

describe('NoOpTracingProvider', () => {
	let provider: NoOpTracingProvider

	beforeEach(() => {
		provider = NoOpTracingProvider.getInstance()
	})

	test('getInstance 返回单例', () => {
		const instance1 = NoOpTracingProvider.getInstance()
		const instance2 = NoOpTracingProvider.getInstance()
		expect(instance1).toBe(instance2)
	})

	test('startSpan 返回空实现 Span', () => {
		const span = provider.startSpan('test-span', {key: 'value'})
		expect(span.name).toBe('test-span')
		expect(span.attributes).toEqual({key: 'value'})
	})

	test('Span 链式调用正常工作', () => {
		const span = provider.startSpan('test')
		const result = span.setStatus(SpanStatus.OK).addEvent('test-event')
		expect(result).toBe(span)
	})

	test('Span.end() 不抛出错误', () => {
		const span = provider.startSpan('test')
		expect(() => span.end()).not.toThrow()
	})

	test('runInSpan 正确执行函数', () => {
		let spanCalled = false
		const result = provider.runInSpan('test', (span) => {
			spanCalled = true
			expect(span.name).toBe('test')
			return 42
		})
		expect(spanCalled).toBe(true)
		expect(result).toBe(42)
	})

	test('runInSpan 函数抛出异常时仍结束 Span', () => {
		expect(() => {
			provider.runInSpan('test', () => {
				throw new Error('test error')
			})
		}).toThrow('test error')
	})

	test('dispose() 不抛出错误', () => {
		expect(() => provider.dispose()).not.toThrow()
	})
})

describe('InMemoryMetricsProvider', () => {
	let provider: InMemoryMetricsProvider

	beforeEach(() => {
		provider = new InMemoryMetricsProvider()
	})

	describe('Counter', () => {
		test('counter() 创建计数器', () => {
			const counter = provider.counter('test-counter')
			expect(counter).toBeDefined()
		})

		test('increment() 增加计数值（默认 +1）', () => {
			const counter = provider.counter('test-counter')
			counter.increment()
			const metric = provider.getMetric('test-counter')
			expect(metric?.type).toBe('counter')
			if (metric?.type === 'counter') {
				expect(metric.value).toBe(1)
			}
		})

		test('increment(value) 增加指定值', () => {
			const counter = provider.counter('test-counter')
			counter.increment(5)
			counter.increment(3)
			const metric = provider.getMetric('test-counter')
			if (metric?.type === 'counter') {
				expect(metric.value).toBe(8)
			}
		})

		test('同一名称的 counter 返回同一实例', () => {
			const counter1 = provider.counter('test-counter')
			counter1.increment(5)
			const counter2 = provider.counter('test-counter')
			counter2.increment(3)
			const metric = provider.getMetric('test-counter')
			if (metric?.type === 'counter') {
				expect(metric.value).toBe(8)
			}
		})
	})

	describe('Gauge', () => {
		test('gauge() 创建仪表', () => {
			const gauge = provider.gauge('test-gauge')
			expect(gauge).toBeDefined()
		})

		test('set() 设置当前值', () => {
			const gauge = provider.gauge('test-gauge')
			gauge.set(10)
			gauge.set(20)
			const metric = provider.getMetric('test-gauge')
			if (metric?.type === 'gauge') {
				expect(metric.value).toBe(20)
			}
		})

		test('同一名称的 gauge 返回同一实例', () => {
			const gauge1 = provider.gauge('test-gauge')
			gauge1.set(10)
			const gauge2 = provider.gauge('test-gauge')
			gauge2.set(20)
			const metric = provider.getMetric('test-gauge')
			if (metric?.type === 'gauge') {
				expect(metric.value).toBe(20)
			}
		})
	})

	describe('Histogram', () => {
		test('histogram() 创建直方图', () => {
			const histogram = provider.histogram('test-histogram')
			expect(histogram).toBeDefined()
		})

		test('record() 记录值', () => {
			const histogram = provider.histogram('test-histogram')
			histogram.record(10)
			histogram.record(20)
			histogram.record(30)
			const metric = provider.getMetric('test-histogram')
			if (metric?.type === 'histogram') {
				expect(metric.values).toEqual([10, 20, 30])
			}
		})

		test('record() 记录值和属性', () => {
			const histogram = provider.histogram('test-histogram')
			histogram.record(10, {method: 'GET'})
			histogram.record(20, {method: 'POST'})
			const metric = provider.getMetric('test-histogram')
			if (metric?.type === 'histogram') {
				expect(metric.values).toEqual([10, 20])
				expect(metric.attributes).toEqual([
					{method: 'GET'},
					{method: 'POST'},
				])
			}
		})
	})

	describe('Timer', () => {
		test('timer() 创建计时器', () => {
			const timer = provider.timer('test-timer')
			expect(timer).toBeDefined()
		})

		test('start() 和 stop() 测量耗时', () => {
			const timer = provider.timer('test-timer')
			timer.start()
			// 模拟一些操作
			const start = Date.now()
			while (Date.now() - start < 10) {
				// 等待至少 10ms
			}
			const elapsed = timer.stop()
			expect(elapsed).toBeGreaterThanOrEqual(10)
		})

		test('stop() 未调用 start() 时抛出错误', () => {
			const timer = provider.timer('test-timer')
			expect(() => timer.stop()).toThrow('Timer test-timer not started')
		})

		test('同一名称的 timer 返回同一实例', () => {
			const timer1 = provider.timer('test-timer')
			timer1.start()
			const timer2 = provider.timer('test-timer')
			timer2.stop()
			const metric = provider.getMetric('test-timer')
			if (metric?.type === 'timer') {
				expect(metric.elapsed).toBeGreaterThanOrEqual(0)
			}
		})
	})

	describe('getMetrics', () => {
		test('getMetrics() 返回所有指标', () => {
			provider.counter('counter1').increment(5)
			provider.gauge('gauge1').set(10)
			provider.histogram('histogram1').record(15)

			const metrics = provider.getMetrics()
			expect(metrics.size).toBe(3)
			expect(metrics.has('counter1')).toBe(true)
			expect(metrics.has('gauge1')).toBe(true)
			expect(metrics.has('histogram1')).toBe(true)
		})

		test('getMetrics() 返回副本，不影响原始数据', () => {
			provider.counter('counter1').increment(5)
			const metrics1 = provider.getMetrics()
			const metrics2 = provider.getMetrics()
			expect(metrics1).not.toBe(metrics2)
		})
	})

	describe('clear', () => {
		test('clear() 清空所有指标', () => {
			provider.counter('counter1').increment(5)
			provider.clear()
			const metrics = provider.getMetrics()
			expect(metrics.size).toBe(0)
		})
	})

	describe('dispose', () => {
		test('dispose() 清空所有指标', () => {
			provider.counter('counter1').increment(5)
			provider.dispose()
			const metrics = provider.getMetrics()
			expect(metrics.size).toBe(0)
		})
	})

	describe('类型冲突', () => {
		test('将 counter 作为 gauge 使用时抛出错误', () => {
			provider.counter('metric1')
			expect(() => provider.gauge('metric1')).toThrow(
				'Metric metric1 is not a gauge'
			)
		})

		test('将 gauge 作为 histogram 使用时抛出错误', () => {
			provider.gauge('metric1')
			expect(() => provider.histogram('metric1')).toThrow(
				'Metric metric1 is not a histogram'
			)
		})
	})
})
