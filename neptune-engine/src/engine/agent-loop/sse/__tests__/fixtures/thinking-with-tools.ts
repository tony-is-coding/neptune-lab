/**
 * fixture: thinking-with-tools — 模型先 thinking（含 signature）然后输出 tool_use
 *
 * 关键：thinking signature 是 multi-turn 必须保留的；丢了 signature 后续请求会被 API 拒绝。
 */

import type {RawSSEEvent} from '../../sseEvents.js'

export const thinkingWithToolsFixture: RawSSEEvent[] = [
	{
		type: 'message_start',
		message: {
			id: 'msg_test_think',
			type: 'message',
			role: 'assistant',
			model: 'claude-opus-4-20250514',
			content: [],
			stop_reason: null,
			stop_sequence: null,
			usage: {input_tokens: 200, output_tokens: 1},
		},
	} as unknown as RawSSEEvent,
	{
		type: 'content_block_start',
		index: 0,
		content_block: {type: 'thinking', thinking: '', signature: ''},
	} as unknown as RawSSEEvent,
	{
		type: 'content_block_delta',
		index: 0,
		delta: {type: 'thinking_delta', thinking: 'Let me think about '},
	} as unknown as RawSSEEvent,
	{
		type: 'content_block_delta',
		index: 0,
		delta: {type: 'thinking_delta', thinking: 'this carefully.'},
	} as unknown as RawSSEEvent,
	{
		type: 'content_block_delta',
		index: 0,
		delta: {type: 'signature_delta', signature: 'sig_abc_xyz_123'},
	} as unknown as RawSSEEvent,
	{
		type: 'content_block_stop',
		index: 0,
	} as unknown as RawSSEEvent,
	{
		type: 'content_block_start',
		index: 1,
		content_block: {type: 'tool_use', id: 'toolu_def', name: 'Bash', input: {}},
	} as unknown as RawSSEEvent,
	{
		type: 'content_block_delta',
		index: 1,
		delta: {type: 'input_json_delta', partial_json: '{"command":"ls"}'},
	} as unknown as RawSSEEvent,
	{
		type: 'content_block_stop',
		index: 1,
	} as unknown as RawSSEEvent,
	{
		type: 'message_delta',
		delta: {stop_reason: 'tool_use', stop_sequence: null},
		usage: {output_tokens: 50},
	} as unknown as RawSSEEvent,
	{
		type: 'message_stop',
	} as unknown as RawSSEEvent,
]
