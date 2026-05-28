/**
 * withRetry — 通用重试包装器
 *
 * 算法纲要：
 *   for attempt in 0..maxRetries:
 *     try await fn()
 *     catch err:
 *       decision = policy.decide(err, {attempt, elapsedMs})
 *       if decision.retry:
 *         await sleep(decision.waitMs)
 *         continue
 *       else:
 *         throw err
 *
 * 设计原则：
 * - 不绑定具体业务（任何 async 函数都能包）
 * - 取消信号一路传：sleep 期间收到 abort 立即抛 AbortError
 * - 透明：不吞错；最终失败时抛出 last error
 *
 * 参考 cc src/services/api/withRetry.ts 但简化得多。
 */

import type {RetryPolicy} from './RetryPolicy.js'

export interface WithRetryOptions {
	policy: RetryPolicy
	/** 取消信号 */
	signal?: AbortSignal
	/** 每次 retry 前的回调（用于 logging / hook） */
	onRetry?: (info: {
		attempt: number
		waitMs: number
		error: Error
	}) => void | Promise<void>
}

export async function withRetry<T>(
	fn: () => Promise<T>,
	opts: WithRetryOptions,
): Promise<T> {
	const startedAt = Date.now()
	let attempt = 0
	let lastError: unknown

	while (true) {
		try {
			return await fn()
		} catch (err) {
			lastError = err

			// 取消信号 → 立即抛
			if (opts.signal?.aborted) throw err

			const elapsedMs = Date.now() - startedAt
			const decision = opts.policy.decide(err, {attempt, elapsedMs})

			if (!decision.retry) throw err

			if (opts.onRetry) {
				await opts.onRetry({
					attempt,
					waitMs: decision.waitMs,
					error: err instanceof Error ? err : new Error(String(err)),
				})
			}

			await sleepWithAbort(decision.waitMs, opts.signal)
			attempt++
		}
	}
}

/**
 * 可取消的 sleep。
 *
 * 收到 abort 信号立即 reject AbortError；超时正常 resolve。
 */
function sleepWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
	if (ms <= 0) return Promise.resolve()
	if (signal?.aborted) return Promise.reject(new Error('Retry sleep aborted'))
	return new Promise((resolve, reject) => {
		const onAbort = () => {
			clearTimeout(timer)
			reject(new Error('Retry sleep aborted'))
		}
		const timer = setTimeout(() => {
			signal?.removeEventListener('abort', onAbort)
			resolve()
		}, ms)
		signal?.addEventListener('abort', onAbort)
	})
}

// 用 lastError 静默 typecheck
void (typeof Symbol !== 'undefined')
