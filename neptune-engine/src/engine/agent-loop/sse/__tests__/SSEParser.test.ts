/**
 * SSEParser 单测
 *
 * 覆盖：
 * - happy path: text-only / tool-use / thinking-with-tools 三个 fixture
 * - 协议错误：duplicate message_start / 无 message_start / 流提前断 / 未知事件
 * - 错误事件：API error 通过 stream throw → 转 ParsedSSEEvent.error (api_error)
 * - 非空 message_stop 后 emit message_stop 事件
 */

import {describe, expect, it} from 'bun:test'
import {SSEParser} from '../SSEParser.js'
import type {ParsedSSEEvent} from '../../types.js'
import type {RawSSEEvent} from '../sseEvents.js'
import {textOnlyFixture} from './fixtures/text-only.js'
import {toolUseFixture} from './fixtures/tool-use.js'
import {thinkingWithToolsFixture} from './fixtures/thinking-with-tools.js'

async function* fromArray(arr: RawSSEEvent[]): AsyncGenerator<RawSSEEvent> {
	for (const e of arr) yield e
}

async function drain(stream: AsyncIterable<RawSSEEvent>): Promise<ParsedSSEEvent[]> {
	const events: ParsedSSEEvent[] = []
	for await (const e of SSEParser.consume(stream)) events.push(e)
	return events
}

describe('SSEParser', () => {
	describe('happy path', () => {
		it('text-only fixture 输出 5 个事件（start / complete / delta / stop）', async () => {
			const events = await drain(fromArray(textOnlyFixture))
			const types = events.map(e => e.type)
			expect(types).toEqual(['message_start', 'content_block_complete', 'message_delta', 'message_stop'])

			const start = events.find(e => e.type === 'message_start')!
			expect(start).toMatchObject({
				type: 'message_start',
				message: {id: 'msg_test_text', model: 'claude-sonnet-4-20250514'},
			})

			const complete = events.find(e => e.type === 'content_block_complete')!
			expect(complete).toMatchObject({
				type: 'content_block_complete',
				index: 0,
				block: {type: 'text', text: 'The answer is 8.'},
			})

			const delta = events.find(e => e.type === 'message_delta')!
			expect(delta).toMatchObject({
				type: 'message_delta',
				stop_reason: 'end_turn',
				usage: {output_tokens: 5},
			})
		})

		it('tool-use fixture：text 块 + tool_use 块按顺序 emit', async () => {
			const events = await drain(fromArray(toolUseFixture))
			const completes = events.filter(e => e.type === 'content_block_complete')
			expect(completes).toHaveLength(2)

			expect(completes[0]).toMatchObject({
				index: 0,
				block: {type: 'text', text: 'Reading README now.'},
			})
			expect(completes[1]).toMatchObject({
				index: 1,
				block: {type: 'tool_use', id: 'toolu_abc', name: 'Read', input: {file_path: 'README.md'}},
			})

			const delta = events.find(e => e.type === 'message_delta')!
			expect(delta).toMatchObject({stop_reason: 'tool_use'})
		})

		it('thinking-with-tools fixture：thinking signature 必须保留', async () => {
			const events = await drain(fromArray(thinkingWithToolsFixture))
			const completes = events.filter(e => e.type === 'content_block_complete')
			expect(completes).toHaveLength(2)

			expect(completes[0]).toMatchObject({
				index: 0,
				block: {
					type: 'thinking',
					thinking: 'Let me think about this carefully.',
					signature: 'sig_abc_xyz_123',
				},
			})
			expect(completes[1]).toMatchObject({
				index: 1,
				block: {type: 'tool_use', id: 'toolu_def', name: 'Bash', input: {command: 'ls'}},
			})
		})
	})

	describe('protocol errors', () => {
		it('duplicate message_start → emit error (sse_protocol)', async () => {
			const stream: RawSSEEvent[] = [
				{
					type: 'message_start',
					message: {
						id: 'a',
						type: 'message',
						role: 'assistant',
						model: 'm',
						content: [],
						stop_reason: null,
						stop_sequence: null,
						usage: {input_tokens: 0, output_tokens: 0},
					},
				} as unknown as RawSSEEvent,
				{
					type: 'message_start',
					message: {
						id: 'b',
						type: 'message',
						role: 'assistant',
						model: 'm',
						content: [],
						stop_reason: null,
						stop_sequence: null,
						usage: {input_tokens: 0, output_tokens: 0},
					},
				} as unknown as RawSSEEvent,
			]
			const events = await drain(fromArray(stream))
			const error = events.find(e => e.type === 'error')!
			expect(error).toMatchObject({type: 'error', source: 'sse_protocol'})
		})

		it('无 message_start 流结束 → emit error (sse_protocol)', async () => {
			const stream: RawSSEEvent[] = [
				{type: 'message_stop'} as unknown as RawSSEEvent,
			]
			const events = await drain(fromArray(stream))
			const error = events.find(e => e.type === 'error')!
			expect(error).toMatchObject({type: 'error', source: 'sse_protocol'})
		})

		it('未识别事件类型 → emit error (unknown_event)', async () => {
			const stream: RawSSEEvent[] = [
				{
					type: 'message_start',
					message: {
						id: 'a',
						type: 'message',
						role: 'assistant',
						model: 'm',
						content: [],
						stop_reason: null,
						stop_sequence: null,
						usage: {input_tokens: 0, output_tokens: 0},
					},
				} as unknown as RawSSEEvent,
				{type: 'mystery_event', data: 'x'} as unknown as RawSSEEvent,
			]
			const events = await drain(fromArray(stream))
			const error = events.find(e => e.type === 'error')!
			expect(error).toMatchObject({type: 'error', source: 'unknown_event'})
		})

		it('content block 没 stop 流就结束 → emit error (block_state)', async () => {
			const stream: RawSSEEvent[] = [
				{
					type: 'message_start',
					message: {
						id: 'a',
						type: 'message',
						role: 'assistant',
						model: 'm',
						content: [],
						stop_reason: null,
						stop_sequence: null,
						usage: {input_tokens: 0, output_tokens: 0},
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
					delta: {type: 'text_delta', text: 'partial'},
				} as unknown as RawSSEEvent,
				// 没有 content_block_stop，流就结束了
			]
			const events = await drain(fromArray(stream))
			const error = events.find(e => e.type === 'error')!
			expect(error).toMatchObject({type: 'error', source: 'block_state'})
		})
	})

	describe('upstream throws', () => {
		it('stream throw → emit error (api_error)', async () => {
			async function* throwingStream(): AsyncGenerator<RawSSEEvent> {
				yield {
					type: 'message_start',
					message: {
						id: 'a',
						type: 'message',
						role: 'assistant',
						model: 'm',
						content: [],
						stop_reason: null,
						stop_sequence: null,
						usage: {input_tokens: 0, output_tokens: 0},
					},
				} as unknown as RawSSEEvent
				throw new Error('Network broke')
			}
			const events = await drain(throwingStream())
			const error = events.find(e => e.type === 'error')!
			expect(error).toMatchObject({type: 'error', source: 'api_error'})
			if (error.type === 'error') {
				expect(error.error.message).toContain('Network broke')
			}
		})
	})

	describe('usage mapping', () => {
		it('message_delta 的 partial usage 映射成 4 档 UsageSnapshot', async () => {
			const events = await drain(fromArray(textOnlyFixture))
			const delta = events.find(e => e.type === 'message_delta')!
			if (delta.type === 'message_delta') {
				expect(delta.usage).toEqual({
					input_tokens: 0,
					output_tokens: 5,
					cache_creation_input_tokens: 0,
					cache_read_input_tokens: 0,
				})
			}
		})

		it('message_start 的 usage 映射成 4 档 UsageSnapshot', async () => {
			const events = await drain(fromArray(textOnlyFixture))
			const start = events.find(e => e.type === 'message_start')!
			if (start.type === 'message_start') {
				expect(start.message.usage).toEqual({
					input_tokens: 12,
					output_tokens: 1,
					cache_creation_input_tokens: 0,
					cache_read_input_tokens: 0,
				})
			}
		})
	})
})
