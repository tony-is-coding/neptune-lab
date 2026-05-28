/**
 * CircuitBreaker — 连败保护
 *
 * 算法：
 *   - 统计连续失败次数
 *   - 达到 failureThreshold → open（拒绝新请求）
 *   - open 状态持续 resetTimeoutMs → half-open（试探一次）
 *   - half-open 时一次请求成功 → close（恢复）
 *   - half-open 时失败 → open（再 reset 一次）
 *
 * 设计原则：
 * - 简化版（cc 的 src/services/api/CircuitBreaker.ts 类似但更复杂）
 * - per-session（不全局）
 * - 失败计数只算 non_retryable_*（避免 transient 误伤）
 */

export type CircuitState = 'closed' | 'open' | 'half_open'

export interface CircuitBreakerOptions {
	/** 连续失败几次开闸。默认 5。 */
	failureThreshold?: number
	/** open 状态持续多久切到 half_open。默认 30_000ms。 */
	resetTimeoutMs?: number
	/** half_open 状态一次成功才 close（cc 用 halfOpenMaxCalls 探针多次；我们简化为 1）。 */
}

export class CircuitBreaker {
	private state: CircuitState = 'closed'
	private failures = 0
	private openedAt = 0
	private readonly failureThreshold: number
	private readonly resetTimeoutMs: number
	private readonly stateChangeListeners: Array<
		(info: {oldState: CircuitState; newState: CircuitState}) => void
	> = []

	constructor(options: CircuitBreakerOptions = {}) {
		this.failureThreshold = options.failureThreshold ?? 5
		this.resetTimeoutMs = options.resetTimeoutMs ?? 30_000
	}

	/** 在执行操作前调用：true = 允许，false = 熔断中拒绝。 */
	allowRequest(): boolean {
		this.maybeTransitionFromOpen()
		return this.state !== 'open'
	}

	/** 操作成功 → 关闸。 */
	recordSuccess(): void {
		this.failures = 0
		this.transitionTo('closed')
	}

	/** 操作失败 → 累积；达到阈值开闸。 */
	recordFailure(): void {
		this.failures++
		if (this.state === 'half_open') {
			this.transitionTo('open')
			this.openedAt = Date.now()
			return
		}
		if (this.failures >= this.failureThreshold) {
			this.transitionTo('open')
			this.openedAt = Date.now()
		}
	}

	/** 当前状态（getter，方便测试）。 */
	get currentState(): CircuitState {
		this.maybeTransitionFromOpen()
		return this.state
	}

	get failureCount(): number {
		return this.failures
	}

	onStateChange(
		listener: (info: {oldState: CircuitState; newState: CircuitState}) => void,
	): void {
		this.stateChangeListeners.push(listener)
	}

	/** 强制重置（测试用）。 */
	reset(): void {
		this.failures = 0
		this.transitionTo('closed')
	}

	private maybeTransitionFromOpen(): void {
		if (this.state !== 'open') return
		const elapsed = Date.now() - this.openedAt
		if (elapsed >= this.resetTimeoutMs) {
			this.transitionTo('half_open')
		}
	}

	private transitionTo(newState: CircuitState): void {
		if (this.state === newState) return
		const oldState = this.state
		this.state = newState
		for (const listener of this.stateChangeListeners) {
			try {
				listener({oldState, newState})
			} catch {
				/* 静默 listener 错误 */
			}
		}
	}
}
