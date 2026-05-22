/**
 * observability/InMemoryMetricsProvider.ts — 内存 Metrics Provider
 *
 * 将指标存储在内存中的 Metrics Provider，用于：
 * - 测试环境（验证指标是否正确记录）
 * - 开发环境（本地调试）
 *
 * 所有指标都存储在 Map 中，提供 getMetrics() 用于测试。
 */

import type {IMetricsProvider} from './IMetricsProvider'
import type {Counter, Gauge, Histogram, Timer} from './types'

/**
 * 指标值类型
 */
type MetricValue =
	| { type: 'counter'; value: number }
	| { type: 'gauge'; value: number }
	| { type: 'histogram'; values: number[]; attributes: Record<string, unknown>[] }
	| { type: 'timer'; startTime: number | null; elapsed: number | null }

/**
 * 内存 Counter 实现
 */
class InMemoryCounter implements Counter {
	private value = 0

	increment(amount = 1): void {
		this.value += amount
	}

	getValue(): number {
		return this.value
	}
}

/**
 * 内存 Gauge 实现
 */
class InMemoryGauge implements Gauge {
	private value = 0

	set(value: number): void {
		this.value = value
	}

	getValue(): number {
		return this.value
	}
}

/**
 * 内存 Histogram 实现
 */
class InMemoryHistogram implements Histogram {
	private values: number[] = []
	private attributesList: Record<string, unknown>[] = []

	record(value: number, attributes?: Record<string, unknown>): void {
		this.values.push(value)
		this.attributesList.push(attributes ?? {})
	}

	getValues(): number[] {
		return [...this.values]
	}

	getAttributes(): Record<string, unknown>[] {
		return [...this.attributesList]
	}
}

/**
 * 内存 Timer 实现
 */
class InMemoryTimer implements Timer {
	private startTime: number | null = null
	private elapsed: number | null = null

	start(): void {
		this.startTime = Date.now()
		this.elapsed = null
	}

	stop(): number {
		if (this.startTime === null) {
			throw new Error('Timer not started')
		}
		this.elapsed = Date.now() - this.startTime
		this.startTime = null
		return this.elapsed
	}

	getElapsed(): number | null {
		return this.elapsed
	}
}

/**
 * 内存 Metrics Provider
 *
 * 将所有指标存储在内存 Map 中，提供 getMetrics() 用于测试。
 */
export class InMemoryMetricsProvider implements IMetricsProvider {
	private readonly metrics = new Map<string, MetricValue>()

	counter(name: string): Counter {
		if (!this.metrics.has(name)) {
			this.metrics.set(name, {type: 'counter', value: 0})
		}
		const metric = this.metrics.get(name)!
		if (metric.type !== 'counter') {
			throw new Error(`Metric ${name} is not a counter`)
		}
		return {
			increment: (value?: number) => {
				metric.value += value ?? 1
			},
		}
	}

	gauge(name: string): Gauge {
		if (!this.metrics.has(name)) {
			this.metrics.set(name, {type: 'gauge', value: 0})
		}
		const metric = this.metrics.get(name)!
		if (metric.type !== 'gauge') {
			throw new Error(`Metric ${name} is not a gauge`)
		}
		return {
			set: (value: number) => {
				metric.value = value
			},
		}
	}

	histogram(name: string): Histogram {
		if (!this.metrics.has(name)) {
			this.metrics.set(name, {
				type: 'histogram',
				values: [],
				attributes: [],
			})
		}
		const metric = this.metrics.get(name)!
		if (metric.type !== 'histogram') {
			throw new Error(`Metric ${name} is not a histogram`)
		}
		return {
			record: (value: number, attributes?: Record<string, unknown>) => {
				metric.values.push(value)
				metric.attributes.push(attributes ?? {})
			},
		}
	}

	timer(name: string): Timer {
		if (!this.metrics.has(name)) {
			this.metrics.set(name, {
				type: 'timer',
				startTime: null,
				elapsed: null,
			})
		}
		const metric = this.metrics.get(name)!
		if (metric.type !== 'timer') {
			throw new Error(`Metric ${name} is not a timer`)
		}
		return {
			start: () => {
				metric.startTime = Date.now()
			},
			stop: () => {
				if (metric.startTime === null) {
					throw new Error(`Timer ${name} not started`)
				}
				metric.elapsed = Date.now() - metric.startTime
				metric.startTime = null
				return metric.elapsed
			},
		}
	}

	/**
	 * 获取所有指标（用于测试）
	 */
	getMetrics(): Map<string, MetricValue> {
		return new Map(this.metrics)
	}

	/**
	 * 获取指定指标的值
	 */
	getMetric(name: string): MetricValue | undefined {
		return this.metrics.get(name)
	}

	/**
	 * 清空所有指标（用于测试）
	 */
	clear(): void {
		this.metrics.clear()
	}

	dispose(): void {
		this.metrics.clear()
	}
}
