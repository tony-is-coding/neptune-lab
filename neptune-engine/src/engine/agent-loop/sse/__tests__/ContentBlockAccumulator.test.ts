/**
 * ContentBlockAccumulator 单测
 *
 * 覆盖：
 * - happy path: text / tool_use / thinking 三种 block 类型
 * - tool_use input_json_delta 累积 + JSON.parse
 * - thinking signature 必须保留
 * - corner cases: 未知 block 类型 / kind mismatch / 未 start 就 stop / JSON parse 失败
 */

import {describe, expect, it} from 'bun:test'
import {ContentBlockAccumulator} from '../ContentBlockAccumulator.js'
import type {RawSSEEvent} from '../sseEvents.js'

function startEvent(index: number, content_block: unknown): RawSSEEvent {
	return {type: 'content_block_start', index, content_block} as unknown as RawSSEEvent
}
function deltaEvent(index: number, delta: unknown): RawSSEEvent {
	return {type: 'content_block_delta', index, delta} as unknown as RawSSEEvent
}
function stopEvent(index: number): RawSSEEvent {
	return {type: 'content_block_stop', index} as unknown as RawSSEEvent
}

describe('ContentBlockAccumulator', () => {
	describe('text block', () => {
		it('累积多段 text_delta 输出完整 text block', () => {
			const acc = new ContentBlockAccumulator()
			acc.onStart(startEvent(0, {type: 'text', text: ''}) as Extract<RawSSEEvent, {type: 'content_block_start'}>)
			acc.onDelta(deltaEvent(0, {type: 'text_delta', text: 'Hello '}) as Extract<RawSSEEvent, {type: 'content_block_delta'}>)
			acc.onDelta(deltaEvent(0, {type: 'text_delta', text: 'world'}) as Extract<RawSSEEvent, {type: 'content_block_delta'}>)
			const out = acc.onStop(stopEvent(0) as Extract<RawSSEEvent, {type: 'content_block_stop'}>)

			expect(out).toHaveLength(1)
			expect(out[0]).toMatchObject({
				kind: 'complete',
				index: 0,
				block: {type: 'text', text: 'Hello world'},
			})
		})

		it('忽略 content_block_start 自带的 text 内容（cc 兼容）', () => {
			const acc = new ContentBlockAccumulator()
			acc.onStart(startEvent(0, {type: 'text', text: 'INITIAL_NOT_USED'}) as Extract<RawSSEEvent, {type: 'content_block_start'}>)
			acc.onDelta(deltaEvent(0, {type: 'text_delta', text: 'real'}) as Extract<RawSSEEvent, {type: 'content_block_delta'}>)
			const out = acc.onStop(stopEvent(0) as Extract<RawSSEEvent, {type: 'content_block_stop'}>)

			expect(out[0]).toMatchObject({
				kind: 'complete',
				block: {type: 'text', text: 'real'},
			})
		})
	})

	describe('tool_use block', () => {
		it('累积 input_json_delta 后 JSON.parse', () => {
			const acc = new ContentBlockAccumulator()
			acc.onStart(
				startEvent(0, {type: 'tool_use', id: 'toolu_1', name: 'Read', input: {}}) as Extract<
					RawSSEEvent,
					{type: 'content_block_start'}
				>,
			)
			acc.onDelta(deltaEvent(0, {type: 'input_json_delta', partial_json: '{"file_'}) as Extract<RawSSEEvent, {type: 'content_block_delta'}>)
			acc.onDelta(deltaEvent(0, {type: 'input_json_delta', partial_json: 'path":"a.md"}'}) as Extract<RawSSEEvent, {type: 'content_block_delta'}>)
			const out = acc.onStop(stopEvent(0) as Extract<RawSSEEvent, {type: 'content_block_stop'}>)

			expect(out[0]).toMatchObject({
				kind: 'complete',
				block: {type: 'tool_use', id: 'toolu_1', name: 'Read', input: {file_path: 'a.md'}},
			})
		})

		it('input 为空字符串时按空对象处理', () => {
			const acc = new ContentBlockAccumulator()
			acc.onStart(
				startEvent(0, {type: 'tool_use', id: 't1', name: 'NoArg', input: {}}) as Extract<
					RawSSEEvent,
					{type: 'content_block_start'}
				>,
			)
			const out = acc.onStop(stopEvent(0) as Extract<RawSSEEvent, {type: 'content_block_stop'}>)
			expect(out[0]).toMatchObject({
				kind: 'complete',
				block: {type: 'tool_use', id: 't1', name: 'NoArg', input: {}},
			})
		})

		it('input JSON 不合法时 emit error (invalid_input_json)', () => {
			const acc = new ContentBlockAccumulator()
			acc.onStart(
				startEvent(0, {type: 'tool_use', id: 't1', name: 'X', input: {}}) as Extract<
					RawSSEEvent,
					{type: 'content_block_start'}
				>,
			)
			acc.onDelta(deltaEvent(0, {type: 'input_json_delta', partial_json: '{not json'}) as Extract<RawSSEEvent, {type: 'content_block_delta'}>)
			const out = acc.onStop(stopEvent(0) as Extract<RawSSEEvent, {type: 'content_block_stop'}>)

			expect(out[0]).toMatchObject({kind: 'error', source: 'invalid_input_json'})
		})

		it('input 不是 object（数组）时 emit error', () => {
			const acc = new ContentBlockAccumulator()
			acc.onStart(
				startEvent(0, {type: 'tool_use', id: 't1', name: 'X', input: {}}) as Extract<
					RawSSEEvent,
					{type: 'content_block_start'}
				>,
			)
			acc.onDelta(deltaEvent(0, {type: 'input_json_delta', partial_json: '[1,2]'}) as Extract<RawSSEEvent, {type: 'content_block_delta'}>)
			const out = acc.onStop(stopEvent(0) as Extract<RawSSEEvent, {type: 'content_block_stop'}>)

			expect(out[0]).toMatchObject({kind: 'error', source: 'invalid_input_json'})
		})
	})

	describe('thinking block', () => {
		it('累积 thinking_delta + signature_delta 后输出完整 thinking block', () => {
			const acc = new ContentBlockAccumulator()
			acc.onStart(
				startEvent(0, {type: 'thinking', thinking: '', signature: ''}) as Extract<
					RawSSEEvent,
					{type: 'content_block_start'}
				>,
			)
			acc.onDelta(deltaEvent(0, {type: 'thinking_delta', thinking: 'reflect '}) as Extract<RawSSEEvent, {type: 'content_block_delta'}>)
			acc.onDelta(deltaEvent(0, {type: 'thinking_delta', thinking: 'more'}) as Extract<RawSSEEvent, {type: 'content_block_delta'}>)
			acc.onDelta(deltaEvent(0, {type: 'signature_delta', signature: 'sig_xyz'}) as Extract<RawSSEEvent, {type: 'content_block_delta'}>)
			const out = acc.onStop(stopEvent(0) as Extract<RawSSEEvent, {type: 'content_block_stop'}>)

			expect(out[0]).toMatchObject({
				kind: 'complete',
				block: {type: 'thinking', thinking: 'reflect more', signature: 'sig_xyz'},
			})
		})

		it('signature 缺失时仍 emit block（signature 为空字符串），与 cc 行为一致', () => {
			const acc = new ContentBlockAccumulator()
			acc.onStart(
				startEvent(0, {type: 'thinking', thinking: '', signature: ''}) as Extract<
					RawSSEEvent,
					{type: 'content_block_start'}
				>,
			)
			acc.onDelta(deltaEvent(0, {type: 'thinking_delta', thinking: 'partial'}) as Extract<RawSSEEvent, {type: 'content_block_delta'}>)
			const out = acc.onStop(stopEvent(0) as Extract<RawSSEEvent, {type: 'content_block_stop'}>)
			expect(out[0]).toMatchObject({
				kind: 'complete',
				block: {type: 'thinking', thinking: 'partial', signature: ''},
			})
		})
	})

	describe('error: unknown block type', () => {
		it('unsupported block type → emit error (unknown_event)', () => {
			const acc = new ContentBlockAccumulator()
			const out = acc.onStart(
				startEvent(0, {type: 'server_tool_use', id: 'x', name: 'web_search', input: ''}) as Extract<
					RawSSEEvent,
					{type: 'content_block_start'}
				>,
			)
			expect(out[0]).toMatchObject({kind: 'error', source: 'unknown_event'})
		})
	})

	describe('error: kind mismatch', () => {
		it('text_delta 落到 tool_use slot 时 emit error', () => {
			const acc = new ContentBlockAccumulator()
			acc.onStart(
				startEvent(0, {type: 'tool_use', id: 'x', name: 'X', input: {}}) as Extract<
					RawSSEEvent,
					{type: 'content_block_start'}
				>,
			)
			const out = acc.onDelta(deltaEvent(0, {type: 'text_delta', text: 'oops'}) as Extract<RawSSEEvent, {type: 'content_block_delta'}>)
			expect(out[0]).toMatchObject({kind: 'error', source: 'block_state'})
		})

		it('input_json_delta 落到 text slot 时 emit error', () => {
			const acc = new ContentBlockAccumulator()
			acc.onStart(startEvent(0, {type: 'text', text: ''}) as Extract<RawSSEEvent, {type: 'content_block_start'}>)
			const out = acc.onDelta(deltaEvent(0, {type: 'input_json_delta', partial_json: '{}'}) as Extract<RawSSEEvent, {type: 'content_block_delta'}>)
			expect(out[0]).toMatchObject({kind: 'error', source: 'block_state'})
		})
	})

	describe('error: 状态机非法', () => {
		it('未 start 就 delta → emit error (block_state)', () => {
			const acc = new ContentBlockAccumulator()
			const out = acc.onDelta(deltaEvent(5, {type: 'text_delta', text: 'x'}) as Extract<RawSSEEvent, {type: 'content_block_delta'}>)
			expect(out[0]).toMatchObject({kind: 'error', source: 'block_state'})
		})

		it('未 start 就 stop → emit error (block_state)', () => {
			const acc = new ContentBlockAccumulator()
			const out = acc.onStop(stopEvent(7) as Extract<RawSSEEvent, {type: 'content_block_stop'}>)
			expect(out[0]).toMatchObject({kind: 'error', source: 'block_state'})
		})
	})

	describe('hasOpenSlots / reset', () => {
		it('有未 stop 的 slot 时 hasOpenSlots true', () => {
			const acc = new ContentBlockAccumulator()
			acc.onStart(startEvent(0, {type: 'text', text: ''}) as Extract<RawSSEEvent, {type: 'content_block_start'}>)
			expect(acc.hasOpenSlots()).toBe(true)
			acc.reset()
			expect(acc.hasOpenSlots()).toBe(false)
		})

		it('stop 后 slot 自动释放', () => {
			const acc = new ContentBlockAccumulator()
			acc.onStart(startEvent(0, {type: 'text', text: ''}) as Extract<RawSSEEvent, {type: 'content_block_start'}>)
			acc.onStop(stopEvent(0) as Extract<RawSSEEvent, {type: 'content_block_stop'}>)
			expect(acc.hasOpenSlots()).toBe(false)
		})
	})

	describe('未识别 delta 类型', () => {
		it('收到未识别 delta → emit error (unknown_event)', () => {
			const acc = new ContentBlockAccumulator()
			acc.onStart(startEvent(0, {type: 'text', text: ''}) as Extract<RawSSEEvent, {type: 'content_block_start'}>)
			const out = acc.onDelta(deltaEvent(0, {type: 'mystery_delta', value: 'x'}) as Extract<RawSSEEvent, {type: 'content_block_delta'}>)
			expect(out[0]).toMatchObject({kind: 'error', source: 'unknown_event'})
		})

		it('citations_delta 静默忽略（cc 一致）', () => {
			const acc = new ContentBlockAccumulator()
			acc.onStart(startEvent(0, {type: 'text', text: ''}) as Extract<RawSSEEvent, {type: 'content_block_start'}>)
			const out = acc.onDelta(deltaEvent(0, {type: 'citations_delta', citation: {}}) as Extract<RawSSEEvent, {type: 'content_block_delta'}>)
			expect(out).toHaveLength(0)
		})
	})
})
