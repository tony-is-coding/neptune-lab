/**
 * WatchdogProvider — 给 StreamingProvider 包一层 watchdog
 *
 * 设计原则：
 * - 与 RetryingProvider / FallbackProvider 同样的组合模式
 * - 当 watchdog 触发时，stream emit 一个 api_error 事件后退出
 *   （RetryingProvider 在外层包时可重试这个错误）
 *
 * 推荐组合顺序（外到内）：
 *   FallbackProvider → RetryingProvider → WatchdogProvider → AnthropicStreamingProvider
 *
 * 这样：watchdog 触发 → emit error → retry 重新发起 → 仍 idle 多次 → fallback 切 model
 */

import type {ParsedSSEEvent} from '../types.js'
import type {
	StreamingProviderAdapter,
	StreamingQueryParams,
} from '../provider/StreamingProviderAdapter.js'
import {withStreamWatchdog, type StreamWatchdogOptions} from './StreamWatchdog.js'

export class WatchdogProvider implements StreamingProviderAdapter {
	readonly type: string

	constructor(
		private readonly inner: StreamingProviderAdapter,
		private readonly watchdogOptions: StreamWatchdogOptions = {},
	) {
		this.type = inner.type
	}

	async *queryStream(
		params: StreamingQueryParams,
	): AsyncGenerator<ParsedSSEEvent, void, unknown> {
		yield* withStreamWatchdog(this.inner.queryStream(params), this.watchdogOptions)
	}
}
