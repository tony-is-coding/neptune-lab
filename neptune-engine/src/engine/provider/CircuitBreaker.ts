/**
 * CircuitBreaker — 熔断器
 *
 * @planned V19 接入计划
 *
 * 实现熔断器模式，防止级联故障：
 * - closed（关闭）：正常状态，请求正常执行
 * - open（打开）：熔断状态，拒绝所有请求
 * - half-open（半开）：试探状态，允许少量请求通过
 *
 * 状态转换：
 * - closed → open：失败次数达到阈值
 * - open → half-open：超过重置超时时间
 * - half-open → closed：请求成功
 * - half-open → open：请求失败
 *
 * **接入计划（V19）**：
 * 1. 在 ProviderAdapter 中集成 CircuitBreaker
 * 2. 为每个 Provider 配置独立的熔断器实例
 * 3. 在 executeWithRetry 中使用熔断器包装请求
 * 4. 添加熔断器状态监控和告警
 *
 * **当前状态**：功能完整实现，等待接入到 ProviderAdapter
 */

import {LogUtil} from '../log/LogUtil.js'
import {EngineError, EngineErrorCode} from '../errors.js'

// ============================================================
// 类型定义
// ============================================================

/**
 * 熔断器状态
 */
export type CircuitBreakerState = 'closed' | 'open' | 'half-open'

/**
 * 状态变化事件
 */
export interface CircuitBreakerStateChangedEvent {
	name: string
	oldState: CircuitBreakerState
	newState: CircuitBreakerState
	timestamp: number
}

/**
 * 状态变化回调函数
 */
type StateChangeCallback = (event: CircuitBreakerStateChangedEvent) => void

/**
 * 熔断器配置
 */
export interface CircuitBreakerConfig {
	/** 失败次数阈值（默认 5） */
	failureThreshold: number
	/** 重置超时时间，单位毫秒（默认 30000，即 30 秒） */
	resetTimeoutMs: number
	/** 半开状态下的最大试探请求数（默认 3） */
	halfOpenMaxCalls: number
	/** 状态变化回调（可选） */
	onStateChanged?: StateChangeCallback
}

// ============================================================
// CircuitBreaker 类
// ============================================================

/**
 * 熔断器
 *
 * 防止故障服务被持续调用，提供快速失败机制。
 */
export class CircuitBreaker {
	private failureCount = 0
	private lastFailureTime = 0
	private state: CircuitBreakerState = 'closed'
	private halfOpenCallCount = 0

	constructor(
		private readonly name: string,
		private readonly config: CircuitBreakerConfig = {
			failureThreshold: 5,
			resetTimeoutMs: 30000,
			halfOpenMaxCalls: 3,
		},
	) {
	}

	/**
	 * 触发状态变化事件
	 */
	private notifyStateChanged(oldState: CircuitBreakerState, newState: CircuitBreakerState): void {
		if (this.config.onStateChanged) {
			this.config.onStateChanged({
				name: this.name,
				oldState,
				newState,
				timestamp: Date.now(),
			})
		}
	}

	/**
	 * 检查是否可以执行请求
	 *
	 * @returns 是否可以执行
	 */
	canExecute(): boolean {
		const now = Date.now()

		// open 状态下，检查是否可以转换到 half-open
		if (this.state === 'open') {
			if (now - this.lastFailureTime >= this.config.resetTimeoutMs) {
				const oldState = this.state
				LogUtil.debug(`CircuitBreaker "${this.name}" 进入半开状态`, {
					state: this.state,
					resetTimeoutMs: this.config.resetTimeoutMs,
				})
				this.state = 'half-open'
				this.halfOpenCallCount = 0
				this.notifyStateChanged(oldState, this.state)
				return true
			}
			return false
		}

		// half-open 状态下，限制试探请求数
		if (this.state === 'half-open') {
			if (this.halfOpenCallCount >= this.config.halfOpenMaxCalls) {
				return false
			}
			return true
		}

		// closed 状态正常执行
		return true
	}

	/**
	 * 记录成功
	 *
	 * 重置失败计数，根据状态转换。
	 */
	recordSuccess(): void {
		if (this.state === 'half-open') {
			const oldState = this.state
			LogUtil.debug(`CircuitBreaker "${this.name}" 从半开转为关闭`, {
				state: this.state,
			})
			this.state = 'closed'
			this.failureCount = 0
			this.halfOpenCallCount = 0
			this.notifyStateChanged(oldState, this.state)
		} else if (this.state === 'closed') {
			this.failureCount = 0
		}
	}

	/**
	 * 记录失败
	 *
	 * 增加失败计数，根据状态转换。
	 */
	recordFailure(): void {
		this.failureCount++
		this.lastFailureTime = Date.now()

		if (this.state === 'half-open') {
			const oldState = this.state
			LogUtil.warn(`CircuitBreaker "${this.name}" 从半开转为打开`, {
				failureCount: this.failureCount,
			})
			this.state = 'open'
			this.halfOpenCallCount = 0
			this.notifyStateChanged(oldState, this.state)
		} else if (this.state === 'closed' && this.failureCount >= this.config.failureThreshold) {
			const oldState = this.state
			LogUtil.warn(`CircuitBreaker "${this.name}" 触发熔断`, {
				failureCount: this.failureCount,
				threshold: this.config.failureThreshold,
			})
			this.state = 'open'
			this.notifyStateChanged(oldState, this.state)
		}
	}

	/**
	 * 获取当前状态
	 *
	 * @returns 当前状态
	 */
	getState(): CircuitBreakerState {
		return this.state
	}

	/**
	 * 获取失败计数
	 *
	 * @returns 当前失败次数
	 */
	getFailureCount(): number {
		return this.failureCount
	}

	/**
	 * 重置熔断器
	 *
	 * 将状态重置为 closed，清空计数。
	 */
	reset(): void {
		this.state = 'closed'
		this.failureCount = 0
		this.lastFailureTime = 0
		this.halfOpenCallCount = 0
		LogUtil.debug(`CircuitBreaker "${this.name}" 已重置`)
	}

	/**
	 * 使用熔断器执行操作
	 *
	 * @param fn 要执行的异步函数
	 * @returns 函数执行结果
	 * @throws 熔断器打开时抛出错误
	 */
	async execute<T>(fn: () => Promise<T>): Promise<T> {
		if (!this.canExecute()) {
			throw new EngineError(
				EngineErrorCode.CIRCUIT_OPEN,
				`CircuitBreaker "${this.name}" is ${this.state}, request rejected`
			)
		}

		if (this.state === 'half-open') {
			this.halfOpenCallCount++
		}

		try {
			const result = await fn()
			this.recordSuccess()
			return result
		} catch (error) {
			this.recordFailure()
			throw error
		}
	}
}
