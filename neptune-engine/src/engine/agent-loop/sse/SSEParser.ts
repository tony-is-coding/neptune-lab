/**
 * SSEParser — 把 Anthropic SSE 流解析成 ParsedSSEEvent
 *
 * 算法纲要（参考 cc claude.ts:1993-2310 queryModel 主循环，去除 product 干扰后）：
 *
 *   for await (raw of stream):
 *     switch (raw.type):
 *       'message_start'        → emit ParsedSSEEvent.message_start
 *       'content_block_start'  → accumulator.onStart 内部累积
 *       'content_block_delta'  → accumulator.onDelta 累积
 *       'content_block_stop'   → accumulator.onStop → emit content_block_complete
 *       'message_delta'        → emit message_delta（更新 stop_reason / usage）
 *       'message_stop'         → emit message_stop（不退出循环；流自然结束）
 *       未识别 type             → emit error (source: unknown_event)，fail-loud 不静默
 *
 *   stream 结束后：
 *     if accumulator 还有未完成 slot → emit error (source: block_state)
 *
 * 与 cc 行为差异（详见 __tests__/oracle/README.md）：
 * - 不抄 stall detection / stream watchdog（Batch 13 在外层做）
 * - 不抄 tengu_streaming_* analytics 埋点
 * - 不抄 connector_text 分支
 * - 不抄 advisor_tool_use / advisor_tool_result
 * - 不抄 USER_TYPE='ant' research 字段提取
 * - 不抄 message_stop 后立即 cleanupStream（取消由上层 AgentLoop / Cancellation 模块处理）
 */

import {EngineError, EngineErrorCode} from '../../errors.js'
import type {ParsedSSEEvent} from '../types.js'
import {ContentBlockAccumulator, accumulatorOutputToParsedEvent} from './ContentBlockAccumulator.js'
import type {RawSSEEvent} from './sseEvents.js'
import {mapSdkUsage, mapStopReason, partialMessageFromStart} from './sseEvents.js'

/**
 * SSEParser 是一个无状态外壳，每次 consume 创建独立的 accumulator。
 * 这样多个 stream 之间不会污染状态。
 */
export class SSEParser {
	/**
	 * 消费一个 Anthropic SSE 流，emit ParsedSSEEvent 序列。
	 *
	 * 不抛错：所有错误都通过 ParsedSSEEvent.error 暴露给上层，
	 * 让 AgentLoop 决策（abort / retry / pass to model）。
	 */
	static async *consume(
		stream: AsyncIterable<RawSSEEvent>,
	): AsyncGenerator<ParsedSSEEvent, void, unknown> {
		const accumulator = new ContentBlockAccumulator()
		let messageStartSeen = false
		let messageStopSeen = false

		try {
			for await (const raw of stream) {
				switch (raw.type) {
					case 'message_start': {
						if (messageStartSeen) {
							yield {
								type: 'error',
								source: 'sse_protocol',
								error: new EngineError(
									EngineErrorCode.EXECUTION_ERROR,
									'SSE: duplicate message_start in single stream',
								),
							}
							return
						}
						messageStartSeen = true
						yield {
							type: 'message_start',
							message: partialMessageFromStart(raw),
						}
						break
					}
					case 'content_block_start': {
						for (const out of accumulator.onStart(raw)) {
							yield accumulatorOutputToParsedEvent(out)
						}
						break
					}
					case 'content_block_delta': {
						for (const out of accumulator.onDelta(raw)) {
							yield accumulatorOutputToParsedEvent(out)
						}
						break
					}
					case 'content_block_stop': {
						for (const out of accumulator.onStop(raw)) {
							yield accumulatorOutputToParsedEvent(out)
						}
						break
					}
					case 'message_delta': {
						yield {
							type: 'message_delta',
							usage: mapSdkUsage(raw.usage),
							stop_reason: mapStopReason(raw.delta?.stop_reason),
						}
						break
					}
					case 'message_stop': {
						messageStopSeen = true
						yield {type: 'message_stop'}
						break
					}
					default: {
						// fail-loud：未识别事件类型立即暴露给上层，不静默 fallback。
						const t = (raw as {type?: string}).type ?? 'unknown'
						yield {
							type: 'error',
							source: 'unknown_event',
							error: new EngineError(
								EngineErrorCode.EXECUTION_ERROR,
								`SSE: unsupported event type '${t}'`,
							),
						}
						break
					}
				}
			}

			// 流自然结束后，如果累积器还有未完成 slot 或者从未见过 message_start，
			// 都属于 SSE 协议异常，emit error 让上层决策。
			if (accumulator.hasOpenSlots()) {
				yield {
					type: 'error',
					source: 'block_state',
					error: new EngineError(
						EngineErrorCode.EXECUTION_ERROR,
						'SSE: stream ended with open content blocks',
					),
				}
			}
			if (!messageStartSeen) {
				yield {
					type: 'error',
					source: 'sse_protocol',
					error: new EngineError(
						EngineErrorCode.EXECUTION_ERROR,
						'SSE: stream ended without message_start',
					),
				}
			}
			// messageStopSeen === false 时不 emit error；
			// cc 在某些 fallback 路径里也会缺 message_stop，上层用 stop_reason 判定即可。
			void messageStopSeen
		} catch (error) {
			// 上游 stream throw（比如 SDK 网络错误） → 标准化成 ParsedSSEEvent.error
			yield {
				type: 'error',
				source: 'api_error',
				error:
					error instanceof Error
						? error
						: new EngineError(
								EngineErrorCode.EXECUTION_ERROR,
								`SSE: stream threw non-Error: ${String(error)}`,
						  ),
			}
		} finally {
			accumulator.reset()
		}
	}
}
