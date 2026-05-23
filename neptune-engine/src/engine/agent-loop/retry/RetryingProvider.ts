/**
 * RetryingProvider — 给 StreamingProvider 包一层 retry
 *
 * 设计原则：
 * - 通过组合（不继承）给已有 provider 加 retry 能力
 * - 一次 queryStream 调用最多 retry N 次（针对建立连接 / 第一次错误）
 * - 流中途的错误（已 emit 过 message_start）不重试 —— 那需要 fallback 处理
 *
 * 重试触发条件：
 * - provider.queryStream 在第一个事件之前 emit `error` (api_error) → 视作连接级错误，重试
 * - 第一个事件已 emit 后再 emit `error` → 不重试（partial response）
 *
 * 使用方式：
 *   const provider = new RetryingProvider(
 *     new AnthropicStreamingProvider(config),
 *     new DefaultRetryPolicy(),
 *   )
 */

import type {ParsedSSEEvent} from '../types.js'
import type {
	StreamingProviderAdapter,
	StreamingQueryParams,
} from '../provider/StreamingProviderAdapter.js'
import type {RetryPolicy} from './RetryPolicy.js'

export interface RetryingProviderOptions {
	policy: RetryPolicy
	onRetry?: (info: {attempt: number; waitMs: number; error: Error}) => void | Promise<void>
}

export class RetryingProvider implements StreamingProviderAdapter {
	readonly type: string

	constructor(
		private readonly inner: StreamingProviderAdapter,
		private readonly options: RetryingProviderOptions,
	) {
		this.type = inner.type
	}

	async *queryStream(
		params: StreamingQueryParams,
	): AsyncGenerator<ParsedSSEEvent, void, unknown> {
		let attempt = 0
		const startedAt = Date.now()

		while (true) {
			// 收第一个事件
			const stream = this.inner.queryStream(params)
			const first = await stream.next()

			// 第一个事件就是 error，且属于 api_error → 尝试 retry
			if (
				!first.done &&
				first.value &&
				first.value.type === 'error' &&
				first.value.source === 'api_error'
			) {
				const errorEvent = first.value
				const elapsedMs = Date.now() - startedAt
				const decision = this.options.policy.decide(errorEvent.error, {
					attempt,
					elapsedMs,
				})
				if (decision.retry) {
					if (this.options.onRetry) {
						await this.options.onRetry({
							attempt,
							waitMs: decision.waitMs,
							error: errorEvent.error,
						})
					}
					// abort signal 检查
					if (params.signal?.aborted) {
						yield errorEvent // 透传错误
						return
					}
					try {
						await sleepWithAbort(decision.waitMs, params.signal)
					} catch {
						// abort 期间 sleep 被中断 → 透传原错误并退出
						yield errorEvent
						return
					}
					attempt++
					// 关掉旧 stream
					if (typeof stream.return === 'function') {
						await stream.return(undefined)
					}
					continue
				}
			}

			// 第一个事件不是错误，或不可重试 → 透传整个流
			if (!first.done && first.value) yield first.value
			while (true) {
				const next = await stream.next()
				if (next.done) return
				if (next.value) yield next.value
			}
		}
	}
}

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
