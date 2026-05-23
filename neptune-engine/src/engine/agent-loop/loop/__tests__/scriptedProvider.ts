/**
 * ScriptedProvider — 测试用 mock provider，按顺序产出预设的 SSE 流
 *
 * 目的：让 AgentLoop 可以用确定性"模型脚本"测试 multi-turn 行为，
 * 不依赖真实 API。同时不引入 mock SDK 的复杂度。
 *
 * 使用方式：
 *   const provider = new ScriptedProvider([
 *     [...turn1Events],
 *     [...turn2Events],
 *   ])
 */

import type {ParsedSSEEvent} from '../../types.js'
import type {
	StreamingProviderAdapter,
	StreamingQueryParams,
} from '../../provider/StreamingProviderAdapter.js'

export class ScriptedProvider implements StreamingProviderAdapter {
	readonly type = 'scripted' as const
	private readonly turns: ParsedSSEEvent[][]
	private cursor = 0
	/** 记录每次 queryStream 的入参，方便断言。 */
	public readonly callLog: StreamingQueryParams[] = []

	constructor(turns: ParsedSSEEvent[][]) {
		this.turns = turns
	}

	async *queryStream(
		params: StreamingQueryParams,
	): AsyncGenerator<ParsedSSEEvent, void, unknown> {
		// 存 snapshot，避免后续 mutation 污染（AgentLoop 内部 messages 数组会被 push）
		this.callLog.push({
			...params,
			messages: [...params.messages],
			...(params.resolvedTools && {resolvedTools: [...params.resolvedTools]}),
		})
		if (this.cursor >= this.turns.length) {
			yield {
				type: 'error',
				source: 'api_error',
				error: new Error(
					`ScriptedProvider: no more turns scripted (cursor=${this.cursor})`,
				),
			}
			return
		}
		const events = this.turns[this.cursor++]
		for (const e of events!) yield e
	}
}

// ============================================================
// 便捷 fixture builders
// ============================================================

/**
 * 单轮：模型只输出一段文字 + end_turn。
 */
export function textTurn(text: string, model = 'm', usage = {input: 10, output: 5}): ParsedSSEEvent[] {
	return [
		{
			type: 'message_start',
			message: {
				id: `msg_${Math.random().toString(36).slice(2, 8)}`,
				role: 'assistant',
				model,
				type: 'message',
				stop_reason: null,
				stop_sequence: null,
				usage: {
					input_tokens: usage.input,
					output_tokens: 1,
					cache_creation_input_tokens: 0,
					cache_read_input_tokens: 0,
				},
			},
		},
		{type: 'content_block_complete', index: 0, block: {type: 'text', text}},
		{
			type: 'message_delta',
			usage: {
				input_tokens: 0,
				output_tokens: usage.output,
				cache_creation_input_tokens: 0,
				cache_read_input_tokens: 0,
			},
			stop_reason: 'end_turn',
		},
		{type: 'message_stop'},
	]
}

/**
 * 单轮：模型 emit tool_use（一个工具）+ 可选前置文本，stop_reason=tool_use。
 */
export function toolUseTurn(
	toolUseId: string,
	toolName: string,
	input: Record<string, unknown>,
	leadingText?: string,
): ParsedSSEEvent[] {
	const events: ParsedSSEEvent[] = [
		{
			type: 'message_start',
			message: {
				id: `msg_${Math.random().toString(36).slice(2, 8)}`,
				role: 'assistant',
				model: 'm',
				type: 'message',
				stop_reason: null,
				stop_sequence: null,
				usage: {
					input_tokens: 10,
					output_tokens: 1,
					cache_creation_input_tokens: 0,
					cache_read_input_tokens: 0,
				},
			},
		},
	]
	let idx = 0
	if (leadingText) {
		events.push({
			type: 'content_block_complete',
			index: idx++,
			block: {type: 'text', text: leadingText},
		})
	}
	events.push({
		type: 'content_block_complete',
		index: idx++,
		block: {type: 'tool_use', id: toolUseId, name: toolName, input},
	})
	events.push({
		type: 'message_delta',
		usage: {
			input_tokens: 0,
			output_tokens: 20,
			cache_creation_input_tokens: 0,
			cache_read_input_tokens: 0,
		},
		stop_reason: 'tool_use',
	})
	events.push({type: 'message_stop'})
	return events
}

/**
 * 错误流：直接 emit ParsedSSEEvent.error。
 */
export function errorTurn(message: string): ParsedSSEEvent[] {
	return [
		{
			type: 'error',
			source: 'api_error',
			error: new Error(message),
		},
	]
}
