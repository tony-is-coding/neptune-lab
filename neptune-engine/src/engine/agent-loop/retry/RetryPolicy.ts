/**
 * RetryPolicy — substrate 默认重试策略
 *
 * 算法纲要（参考 cc withRetry.ts 但更简）：
 *
 *   - 默认上限 5 次（Anthropic SDK 默认值）
 *   - 指数退避：500ms × 2^attempt + jitter
 *   - 总时间不超过 60s（避免 hang）
 *   - retryable_rate_limited 优先用 retry-after 提示
 *   - retryable_transient 用 backoff
 *   - 其他类型立即放弃 retry
 *
 * 设计原则：
 * - 接口 + 默认实现 + 可注入
 * - product 可换 policy（更激进 / 更保守 / 自定义错误分类）
 */

import type {ErrorClassification} from './ErrorClassifier.js'
import {classifyError, isRetryable} from './ErrorClassifier.js'

export interface RetryDecision {
	/** 是否要重试 */
	retry: boolean
	/** 重试前等待的毫秒数（retry=true 时有效） */
	waitMs: number
	/** 错误分类 */
	classification: ErrorClassification
	/** 终止原因（retry=false 时） */
	reason?: 'exhausted' | 'non_retryable' | 'budget_exceeded'
}

export interface RetryContext {
	/** 已尝试次数（0 = 第一次还没失败） */
	attempt: number
	/** 已经累计花了多少 ms 在 retry 上 */
	elapsedMs: number
}

export interface RetryPolicy {
	decide(error: unknown, context: RetryContext): RetryDecision
}

// ============================================================
// 默认 policy
// ============================================================

export interface DefaultRetryPolicyOptions {
	/** 最大尝试次数（不含第一次原始调用，所以 5 = 重试 5 次 = 总共 6 次尝试）。默认 5。 */
	maxRetries?: number
	/** 退避基数（ms）。默认 500。 */
	baseDelayMs?: number
	/** 最大单次延迟（ms）。默认 30_000。 */
	maxDelayMs?: number
	/** retry 总时间预算（ms）。超过则放弃。默认 60_000。 */
	totalBudgetMs?: number
	/** 是否加 jitter（±20%）。默认 true。 */
	jitter?: boolean
}

export class DefaultRetryPolicy implements RetryPolicy {
	private readonly maxRetries: number
	private readonly baseDelayMs: number
	private readonly maxDelayMs: number
	private readonly totalBudgetMs: number
	private readonly jitter: boolean

	constructor(options: DefaultRetryPolicyOptions = {}) {
		this.maxRetries = options.maxRetries ?? 5
		this.baseDelayMs = options.baseDelayMs ?? 500
		this.maxDelayMs = options.maxDelayMs ?? 30_000
		this.totalBudgetMs = options.totalBudgetMs ?? 60_000
		this.jitter = options.jitter ?? true
	}

	decide(error: unknown, context: RetryContext): RetryDecision {
		const classification = classifyError(error)

		// 不可重试 → 直接放弃
		if (!isRetryable(classification.cls)) {
			return {retry: false, waitMs: 0, classification, reason: 'non_retryable'}
		}

		// 达到最大尝试次数 → 放弃
		if (context.attempt >= this.maxRetries) {
			return {retry: false, waitMs: 0, classification, reason: 'exhausted'}
		}

		// 计算退避时间
		let waitMs: number
		if (
			classification.cls === 'retryable_rate_limited' &&
			typeof classification.retryAfterSeconds === 'number'
		) {
			// 优先用 server 给的 retry-after
			waitMs = Math.min(classification.retryAfterSeconds * 1000, this.maxDelayMs)
		} else {
			// 指数退避
			waitMs = Math.min(this.baseDelayMs * Math.pow(2, context.attempt), this.maxDelayMs)
		}
		if (this.jitter) {
			const factor = 0.8 + Math.random() * 0.4 // 0.8 - 1.2
			waitMs = Math.floor(waitMs * factor)
		}

		// 超出总预算 → 放弃
		if (context.elapsedMs + waitMs > this.totalBudgetMs) {
			return {retry: false, waitMs: 0, classification, reason: 'budget_exceeded'}
		}

		return {retry: true, waitMs, classification}
	}
}
