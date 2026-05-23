/**
 * ModelFallback — 主 model 不可用时切到备用 model
 *
 * 设计原则：
 * - 简单：只在 non_retryable_model_not_found / 持续 5xx 之后才 fallback
 * - 透明：emit 一个特殊 LoopEvent 标记发生了 fallback（让 product 通知用户）
 * - 一次 fallback：fallback 后再失败就直接抛错（不递归 fallback）
 *
 * 当前 batch 实现 ModelFallback 包装器；Batch 13 会把它接入 AgentLoop 的可选注入。
 *
 * 与 cc 行为差异：
 * - 不抄 cc 的 onStreamingFallback 业务回调（在 hook 上做即可）
 * - 不抄 tombstone 流程（目前我们丢弃失败 turn 的 partial 数据 — 简化 M1/M2）
 */

import type {ParsedSSEEvent} from '../types.js'
import type {
	StreamingProviderAdapter,
	StreamingQueryParams,
} from '../provider/StreamingProviderAdapter.js'
import {classifyError} from '../retry/ErrorClassifier.js'

export interface ModelFallbackOptions {
	/** 备用 model id（主 model 失败时切换）。 */
	fallbackModel: string
	/** Fallback 触发回调（可让 product 通知用户）。 */
	onFallback?: (info: {primaryModel: string; fallbackModel: string; error: Error}) => void | Promise<void>
}

/**
 * FallbackProvider — 包一层 provider，主 model 挂掉自动切 fallback
 */
export class FallbackProvider implements StreamingProviderAdapter {
	readonly type: string

	constructor(
		private readonly inner: StreamingProviderAdapter,
		private readonly options: ModelFallbackOptions,
	) {
		this.type = inner.type
	}

	async *queryStream(
		params: StreamingQueryParams,
	): AsyncGenerator<ParsedSSEEvent, void, unknown> {
		// 第一次：用原 model
		const primaryModel = params.model
		const primaryStream = this.inner.queryStream(params)
		const primaryFirst = await primaryStream.next()

		if (
			!primaryFirst.done &&
			primaryFirst.value &&
			primaryFirst.value.type === 'error' &&
			primaryFirst.value.source === 'api_error' &&
			this.shouldFallback(primaryFirst.value.error)
		) {
			const errorEvent = primaryFirst.value
			// 触发 fallback
			if (this.options.onFallback) {
				await this.options.onFallback({
					primaryModel,
					fallbackModel: this.options.fallbackModel,
					error: errorEvent.error,
				})
			}
			if (typeof primaryStream.return === 'function') {
				await primaryStream.return(undefined)
			}
			// 用 fallback model 重新发起
			const fallbackStream = this.inner.queryStream({
				...params,
				model: this.options.fallbackModel,
			})
			for await (const e of fallbackStream) yield e
			return
		}

		// 主 model 没问题（或问题不属于 fallback 范畴）→ 透传整个流
		if (!primaryFirst.done && primaryFirst.value) yield primaryFirst.value
		while (true) {
			const next = await primaryStream.next()
			if (next.done) return
			if (next.value) yield next.value
		}
	}

	/**
	 * 判定错误是否触发 fallback。
	 * - non_retryable_model_not_found（404 model not found）→ fallback
	 * - retryable_transient（持续 500/网络错误）→ fallback（认为主 model 集群挂了）
	 * - 其他 → 不 fallback（让上层 retry 或抛错）
	 */
	private shouldFallback(error: Error): boolean {
		const cls = classifyError(error).cls
		return cls === 'non_retryable_model_not_found' || cls === 'retryable_transient'
	}
}
