import {describe, expect, test} from 'vitest'
import {parseSSEChunk} from './sse-parser'

describe('parseSSEChunk', () => {
  test('keeps partial frames until the terminating blank line arrives', () => {
    const first = parseSSEChunk('', 'event: message\ndata: {"type":"text"')
    expect(first.frames).toEqual([])
    expect(first.buffer).toBe('event: message\ndata: {"type":"text"')

    const second = parseSSEChunk(first.buffer, ',"content":"hello"}\n\n')
    expect(second.buffer).toBe('')
    expect(second.frames).toEqual([
      {event: 'message', data: {type: 'text', content: 'hello'}},
    ])
  })

  test('parses multiple complete frames from one chunk', () => {
    const result = parseSSEChunk('', [
      'event: connected',
      'data: {"type":"connected","requestId":"req-1","threadId":"t1","timestamp":1}',
      '',
      'event: done',
      'data: {"type":"done","requestId":"req-1","usage":{}}',
      '',
      '',
    ].join('\n'))

    expect(result.buffer).toBe('')
    expect(result.frames).toEqual([
      {event: 'connected', data: {type: 'connected', requestId: 'req-1', threadId: 't1', timestamp: 1}},
      {event: 'done', data: {type: 'done', requestId: 'req-1', usage: {}}},
    ])
  })

  test('supports multi-line data and skips malformed JSON frames', () => {
    const result = parseSSEChunk('', [
      'event: message',
      'data: {"type":"text",',
      'data: "content":"hello"}',
      '',
      'event: message',
      'data: not-json',
      '',
      '',
    ].join('\n'))

    expect(result.frames).toEqual([
      {event: 'message', data: {type: 'text', content: 'hello'}},
    ])
  })
})
