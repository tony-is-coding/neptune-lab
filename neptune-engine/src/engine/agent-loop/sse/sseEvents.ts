/**
 * sse/sseEvents.ts — SDK 原始事件类型 → engine 内部类型映射
 *
 * 设计原则：
 * - 只有这一个文件 import @anthropic-ai/sdk 的 SSE 类型
 * - 让 SSEParser / 上层都用 engine 自定义类型，不暴露 SDK 类型
 * - SDK 升级时只改这里
 */

import type {BetaRawMessageStreamEvent} from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs'
import type {UsageSnapshot, StopReason, PartialAssistantMessage} from '../types.js'
import {EMPTY_USAGE} from '../types.js'

/**
 * SDK 原始 SSE 事件（直接复用 SDK 类型，不重新定义）。
 *
 * 这是 SSEParser.consume 的输入流元素类型。
 */
export type RawSSEEvent = BetaRawMessageStreamEvent

/**
 * 累积器内部使用的"in-progress" content block 状态。
 *
 * 不对外暴露。content_block_stop 时根据这些状态 emit CompleteContentBlock。
 */
export type InProgressContentBlock =
	| {kind: 'text'; text: string}
	| {kind: 'tool_use'; id: string; name: string; partialJson: string}
	| {kind: 'thinking'; thinking: string; signature: string}

/**
 * 把 SDK Usage 字段映射成 engine UsageSnapshot。
 *
 * SDK Usage 可能是 partial（缺字段），用 0 兜底。
 * 不抄 server_tool_use（advisor 业务，product 关注点）。
 */
export function mapSdkUsage(
	usage:
		| {
				input_tokens?: number
				output_tokens?: number
				cache_creation_input_tokens?: number | null
				cache_read_input_tokens?: number | null
		  }
		| undefined,
): UsageSnapshot {
	if (!usage) return {...EMPTY_USAGE}
	return {
		input_tokens: usage.input_tokens ?? 0,
		output_tokens: usage.output_tokens ?? 0,
		cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
		cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
	}
}

/**
 * 把 SDK 的 stop_reason 字段映射到 engine StopReason 联合类型。
 *
 * SDK 类型上 stop_reason 是宽松 string，这里收紧。
 * 未知值返回 null（让上层视作 end_turn 处理或报错）。
 */
export function mapStopReason(value: unknown): StopReason {
	if (value === null || value === undefined) return null
	if (typeof value !== 'string') return null
	switch (value) {
		case 'end_turn':
		case 'tool_use':
		case 'max_tokens':
		case 'stop_sequence':
		case 'pause_turn':
		case 'refusal':
			return value
		default:
			return null
	}
}

/**
 * 从 message_start 事件构造 PartialAssistantMessage。
 */
export function partialMessageFromStart(
	event: Extract<RawSSEEvent, {type: 'message_start'}>,
): PartialAssistantMessage {
	const m = event.message
	return {
		id: m.id,
		role: 'assistant',
		model: m.model,
		type: 'message',
		stop_reason: mapStopReason(m.stop_reason),
		stop_sequence: (m.stop_sequence as string | null) ?? null,
		usage: mapSdkUsage(m.usage),
	}
}
