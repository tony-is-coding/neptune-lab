import {describe, expect, test} from 'bun:test'
import {parseSSEFrames, type SSEFrame} from '../sse.js'

describe('parseSSEFrames', () => {
	test('parses LF-delimited frames', () => {
		const input = 'event: client_event\ndata: {"ok":true}\n\n'
		const {frames, remaining} = parseSSEFrames(input)

		expect(remaining).toBe('')
		expect(frames).toEqual([
			{
				event: 'client_event',
				data: '{"ok":true}',
			},
		])
	})

	test('parses CRLF-delimited frames and strips trailing carriage returns', () => {
		const input =
			'event: client_event\r\ndata: {"ok":true}\r\nid: 7\r\n\r\nevent: keepalive\r\ndata: ping\r\n\r\n'
		const {frames, remaining} = parseSSEFrames(input)

		expect(remaining).toBe('')
		expect(frames).toEqual([
			{
				event: 'client_event',
				data: '{"ok":true}',
				id: '7',
			},
			{
				event: 'keepalive',
				data: 'ping',
			},
		])
	})

	test('keeps incomplete trailing frame in remaining buffer for CRLF streams', () => {
		const input = 'event: client_event\r\ndata: {"ok":true}\r\n\r\ndata: {"tail":1}\r\n'
		const {frames, remaining} = parseSSEFrames(input)

		expect(frames).toEqual([
			{
				event: 'client_event',
				data: '{"ok":true}',
			},
		])
		expect(remaining).toBe('data: {"tail":1}\r\n')
	})

	test('handles comment lines (starting with colon)', () => {
		const input = ':keepalive comment\nevent: test\ndata: value\n\n'
		const {frames, remaining} = parseSSEFrames(input)

		expect(remaining).toBe('')
		expect(frames).toHaveLength(1)
		expect(frames[0]).toEqual({
			event: 'test',
			data: 'value',
		})
	})

	test('concatenates multiple data lines per SSE spec', () => {
		const input = 'data: line1\ndata: line2\ndata: line3\n\n'
		const {frames} = parseSSEFrames(input)

		expect(frames).toHaveLength(1)
		expect(frames[0].data).toBe('line1\nline2\nline3')
	})

	test('handles frames with all fields (event, id, data)', () => {
		const input = 'id: 123\nevent: message\ndata: hello world\n\n'
		const {frames} = parseSSEFrames(input)

		expect(frames).toHaveLength(1)
		expect(frames[0]).toEqual({
			id: '123',
			event: 'message',
			data: 'hello world',
		})
	})

	test('strips leading space after colon per SSE spec', () => {
		const input = 'data:  leading space\n\n'
		const {frames} = parseSSEFrames(input)

		expect(frames).toHaveLength(1)
		// The spec says strip ONE leading space, not all spaces
		expect(frames[0].data).toBe(' leading space')
	})

	test('handles empty buffer', () => {
		const {frames, remaining} = parseSSEFrames('')

		expect(frames).toEqual([])
		expect(remaining).toBe('')
	})

	test('handles buffer with only whitespace', () => {
		const {frames, remaining} = parseSSEFrames('   \n\n  ')

		expect(frames).toEqual([])
		// The parser consumes up to the first empty line delimiter
		expect(remaining).toBe('  ')
	})

	test('ignores unknown fields', () => {
		const input = 'retry: 5000\nevent: test\ndata: value\n\n'
		const {frames} = parseSSEFrames(input)

		expect(frames).toHaveLength(1)
		expect(frames[0]).toEqual({
			event: 'test',
			data: 'value',
		})
	})
})
