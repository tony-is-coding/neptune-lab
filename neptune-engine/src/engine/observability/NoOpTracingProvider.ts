/**
 * observability/NoOpTracingProvider.ts — 零开销 Tracing Provider
 *
 * 空实现的 Tracing Provider，用于：
 * - 默认配置（不启用追踪时）
 * - 测试环境（避免副作用）
 *
 * 所有方法都是空实现，确保零开销。
 */

import type {ITracingProvider} from './ITracingProvider'
import type {Span, SpanStatus} from './types'

/**
 * 零开销 Span 实现
 */
class NoOpSpan implements Span {
	readonly name: string
	readonly attributes: Record<string, unknown>

	constructor(name: string, attributes?: Record<string, unknown>) {
		this.name = name
		this.attributes = attributes ?? {}
	}

	setStatus(_status: SpanStatus): Span {
		return this
	}

	addEvent(_name: string, _attributes?: Record<string, unknown>): Span {
		return this
	}

	end(): void {
		// 空实现
	}
}

/**
 * 零开销 Tracing Provider
 *
 * 所有方法返回空实现的 Span，不执行任何实际操作。
 */
export class NoOpTracingProvider implements ITracingProvider {
	private static instance: NoOpTracingProvider | null = null

	private constructor() {
	}

	/**
	 * 获取全局单例
	 */
	static getInstance(): NoOpTracingProvider {
		if (!NoOpTracingProvider.instance) {
			NoOpTracingProvider.instance = new NoOpTracingProvider()
		}
		return NoOpTracingProvider.instance
	}

	startSpan(name: string, attributes?: Record<string, unknown>): Span {
		return new NoOpSpan(name, attributes)
	}

	runInSpan<T>(
		name: string,
		fn: (span: Span) => T,
		attributes?: Record<string, unknown>
	): T {
		const span = this.startSpan(name, attributes)
		try {
			return fn(span)
		} finally {
			span.end()
		}
	}

	dispose(): void {
		// 空实现
	}
}
