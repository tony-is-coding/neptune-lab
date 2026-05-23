/**
 * fixture: tool-use — 模型输出 text 然后 emit tool_use（input 流式 JSON）
 *
 * 等价于：用户问"读 README.md"，模型说"我来读"+ tool_use Read({file_path: 'README.md'})
 */

import type {RawSSEEvent} from '../../sseEvents.js'

export const toolUseFixture: RawSSEEvent[] = [
	{
		type: 'message_start',
		message: {
			id: 'msg_test_tool',
			type: 'message',
			role: 'assistant',
			model: 'claude-sonnet-4-20250514',
			content: [],
			stop_reason: null,
			stop_sequence: null,
			usage: {input_tokens: 80, output_tokens: 1},
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
		delta: {type: 'text_delta', text: 'Reading README now.'},
	} as unknown as RawSSEEvent,
	{
		type: 'content_block_stop',
		index: 0,
	} as unknown as RawSSEEvent,
	{
		type: 'content_block_start',
		index: 1,
		content_block: {type: 'tool_use', id: 'toolu_abc', name: 'Read', input: {}},
	} as unknown as RawSSEEvent,
	// input_json_delta 被切成 3 段，模拟真实流式 JSON
	{
		type: 'content_block_delta',
		index: 1,
		delta: {type: 'input_json_delta', partial_json: '{"file_path":'},
	} as unknown as RawSSEEvent,
	{
		type: 'content_block_delta',
		index: 1,
		delta: {type: 'input_json_delta', partial_json: '"README'},
	} as unknown as RawSSEEvent,
	{
		type: 'content_block_delta',
		index: 1,
		delta: {type: 'input_json_delta', partial_json: '.md"}'},
	} as unknown as RawSSEEvent,
	{
		type: 'content_block_stop',
		index: 1,
	} as unknown as RawSSEEvent,
	{
		type: 'message_delta',
		delta: {stop_reason: 'tool_use', stop_sequence: null},
		usage: {output_tokens: 30},
	} as unknown as RawSSEEvent,
	{
		type: 'message_stop',
	} as unknown as RawSSEEvent,
]
