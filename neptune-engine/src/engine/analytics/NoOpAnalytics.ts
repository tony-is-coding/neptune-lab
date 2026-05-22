/**
 * engine/analytics/NoOpAnalytics.ts
 *
 * No-Op Analytics 实现
 *
 * 用于 SDK 模式下，消除核心路径的 analytics 开销。
 * 所有方法都是空操作，零性能开销。
 */

export type AnalyticsSink = {
	logEvent(eventName: string, properties?: Record<string, unknown>): void
	logEventAsync?(eventName: string, properties?: Record<string, unknown>): Promise<void>
}

export class NoOpAnalyticsSink implements AnalyticsSink {
	logEvent(_eventName: string, _metadata?: Record<string, unknown>): void {
		// No-op
	}

	async logEventAsync(_eventName: string, _metadata?: Record<string, unknown>): Promise<void> {
		// No-op
	}
}

export const noOpAnalyticsSink = new NoOpAnalyticsSink()

/** engine-local logEvent — no-op wrapper, zero product dependency */
export function logEvent(_eventName: string, _properties?: Record<string, unknown>): void {
	// No-op in engine layer
}

/** engine-local reset — no-op, for test compatibility */
export function _resetForTesting(): void {
	// No-op
}

export function attachNoOpAnalytics(): void {
	// No-op: product analytics attachment not available in engine layer
}
