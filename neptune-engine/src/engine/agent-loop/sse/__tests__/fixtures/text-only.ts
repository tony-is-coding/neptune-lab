/**
 * fixture: text-only — 模型只输出纯文本，没有 tool_use / thinking
 * 等价于：用户问"3 + 5 = ?"，模型输出"8"，end_turn
 */

import type {RawSSEEvent} from '../../sseEvents.js'

export const textOnlyFixture: RawSSEEvent[] = [
	{
		type: 'message_start',
		message: {
			id: 'msg_test_text',
			type: 'message',
			role: 'assistant',
			model: 'claude-sonnet-4-20250514',
			content: [],
			stop_reason: null,
			stop_sequence: null,
			usage: {
				input_tokens: 12,
				output_tokens: 1,
				cache_creation_input_tokens: 0,
				cache_read_input_tokens: 0,
				server_tool_use: null,
			},
		},
	} as unknown as RawSSEEvent,
	{
		type: 'content_block_start',
		index: 0,
		content_block: {type: 'text', text: ''},
	} as unknown as RawSSEEvent,
	{
		type: 'content_block_delta',
		index: 0,
		delta: {type: 'text_delta', text: 'The '},
	} as unknown as RawSSEEvent,
	{
		type: 'content_block_delta',
		index: 0,
		delta: {type: 'text_delta', text: 'answer is 8.'},
	} as unknown as RawSSEEvent,
	{
		type: 'content_block_stop',
		index: 0,
	} as unknown as RawSSEEvent,
	{
		type: 'message_delta',
		delta: {stop_reason: 'end_turn', stop_sequence: null},
		usage: {output_tokens: 5},
	} as unknown as RawSSEEvent,
	{
		type: 'message_stop',
	} as unknown as RawSSEEvent,
]
