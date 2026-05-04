import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { writeFileSync, unlinkSync, existsSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  parseTranscript,
  transcriptToMessages,
  type TranscriptMessage,
  type QueryEngineMessage,
} from '../TranscriptParser'

describe('TranscriptParser', () => {
  const TEST_DIR = join(tmpdir(), `claude-transcript-test-${Date.now()}`)
  const TEST_FILE = join(TEST_DIR, 'transcript.jsonl')

  beforeEach(() => {
    // 创建测试目录
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    // 清理测试目录
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true })
    }
  })

  describe('parseTranscript', () => {
    test('文件不存在时返回空数组', () => {
      const result = parseTranscript('/nonexistent/file.jsonl')
      expect(result).toEqual([])
    })

    test('空文件返回空数组', () => {
      writeFileSync(TEST_FILE, '', 'utf-8')
      const result = parseTranscript(TEST_FILE)
      expect(result).toEqual([])
    })

    test('仅包含空白字符的文件返回空数组', () => {
      writeFileSync(TEST_FILE, '   \n\n  \n   ', 'utf-8')
      const result = parseTranscript(TEST_FILE)
      expect(result).toEqual([])
    })

    test('解析有效的 JSONL 文件', () => {
      const content = [
        '{"type":"human","role":"user","content":"Hello"}',
        '{"type":"assistant","role":"assistant","content":["text","Hi there"]}',
      ].join('\n')

      writeFileSync(TEST_FILE, content, 'utf-8')
      const result = parseTranscript(TEST_FILE)

      expect(result).toHaveLength(2)
      expect(result[0].role).toBe('user')
      expect(result[0].content).toBe('Hello')
      expect(result[1].role).toBe('assistant')
      expect(result[1].content).toEqual(['text', 'Hi there'])
    })

    test('跳过空行', () => {
      const content = [
        '{"type":"human","role":"user","content":"Message 1"}',
        '',
        '   ',
        '{"type":"assistant","role":"assistant","content":"Message 2"}',
        '',
      ].join('\n')

      writeFileSync(TEST_FILE, content, 'utf-8')
      const result = parseTranscript(TEST_FILE)

      expect(result).toHaveLength(2)
    })

    test('跳过格式错误的行', () => {
      const content = [
        '{"type":"human","role":"user","content":"Valid 1"}',
        '{invalid json}',
        '{"type":"assistant","role":"assistant","content":"Valid 2"}',
        'not json at all',
        '{"type":"human","role":"user","content":"Valid 3"}',
      ].join('\n')

      writeFileSync(TEST_FILE, content, 'utf-8')
      const result = parseTranscript(TEST_FILE)

      expect(result).toHaveLength(3)
      expect(result[0].content).toBe('Valid 1')
      expect(result[1].content).toBe('Valid 2')
      expect(result[2].content).toBe('Valid 3')
    })

    test('跳过没有 role 字段的行', () => {
      const content = [
        '{"type":"human","role":"user","content":"Valid"}',
        '{"type":"other","content":"No role"}',
        '{"type":"assistant","role":"assistant","content":"Also valid"}',
      ].join('\n')

      writeFileSync(TEST_FILE, content, 'utf-8')
      const result = parseTranscript(TEST_FILE)

      expect(result).toHaveLength(2)
      expect(result[0].role).toBe('user')
      expect(result[1].role).toBe('assistant')
    })

    test('处理复杂的 content 字段', () => {
      const complexContent = [
        {
          type: 'text',
          text: 'Hello',
        },
        {
          type: 'tool_use',
          id: 'tool-1',
          name: 'bash',
          input: { command: 'ls' },
        },
      ]

      const line = JSON.stringify({
        type: 'assistant',
        role: 'assistant',
        content: complexContent,
      })

      writeFileSync(TEST_FILE, line, 'utf-8')
      const result = parseTranscript(TEST_FILE)

      expect(result).toHaveLength(1)
      expect(result[0].content).toEqual(complexContent)
    })

    test('处理带换行符的 JSON', () => {
      const content = JSON.stringify({
        type: 'human',
        role: 'user',
        content: 'Message with\nnewline',
      })

      writeFileSync(TEST_FILE, content, 'utf-8')
      const result = parseTranscript(TEST_FILE)

      expect(result).toHaveLength(1)
      expect(result[0].content).toBe('Message with\nnewline')
    })
  })

  describe('transcriptToMessages', () => {
    test('将 TranscriptMessage 转换为 QueryEngineMessage', () => {
      const transcript: TranscriptMessage[] = [
        { type: 'human', role: 'user', content: 'Hello' },
        { type: 'assistant', role: 'assistant', content: 'Hi there' },
      ]

      const result = transcriptToMessages(transcript)

      expect(result).toHaveLength(2)
      expect(result[0].type).toBe('user')
      expect(result[0].uuid).toBeDefined()
      expect(result[0].message.role).toBe('user')
      expect(result[0].message.content).toBe('Hello')

      expect(result[1].type).toBe('assistant')
      expect(result[1].uuid).toBeDefined()
      expect(result[1].message.role).toBe('assistant')
      expect(result[1].message.content).toBe('Hi there')
    })

    test('过滤非 user/assistant 的消息', () => {
      const transcript: TranscriptMessage[] = [
        { type: 'human', role: 'user', content: 'User message' },
        { type: 'system', role: 'system', content: 'System message' } as any,
        { type: 'assistant', role: 'assistant', content: 'Assistant message' },
        { type: 'other', role: 'other', content: 'Other message' } as any,
      ]

      const result = transcriptToMessages(transcript)

      expect(result).toHaveLength(2)
      expect(result[0].message.role).toBe('user')
      expect(result[1].message.role).toBe('assistant')
    })

    test('为每条消息生成唯一 UUID', () => {
      const transcript: TranscriptMessage[] = [
        { type: 'human', role: 'user', content: 'Message 1' },
        { type: 'assistant', role: 'assistant', content: 'Message 2' },
        { type: 'human', role: 'user', content: 'Message 3' },
      ]

      const result = transcriptToMessages(transcript)
      const uuids = result.map(m => m.uuid)

      expect(new Set(uuids).size).toBe(3) // 所有 UUID 都不同
    })

    test('处理空数组', () => {
      const result = transcriptToMessages([])
      expect(result).toEqual([])
    })

    test('保留原始 content 结构', () => {
      const complexContent = [
        { type: 'text', text: 'Hello' },
        { type: 'tool_use', id: 'tool-1', name: 'bash', input: {} },
      ]

      const transcript: TranscriptMessage[] = [
        { type: 'assistant', role: 'assistant', content: complexContent },
      ]

      const result = transcriptToMessages(transcript)

      expect(result[0].message.content).toEqual(complexContent)
    })

    test('映射 human type 为 user', () => {
      const transcript: TranscriptMessage[] = [
        { type: 'human', role: 'user', content: 'Hello' },
      ]

      const result = transcriptToMessages(transcript)

      expect(result[0].type).toBe('user')
      expect(result[0].message.role).toBe('user')
    })
  })

  describe('集成测试', () => {
    test('完整流程：解析文件并转换消息', () => {
      const content = [
        '{"type":"human","role":"user","content":"List files"}',
        '{"type":"assistant","role":"assistant","content":["text","file1.txt\\nfile2.txt"]}',
        '{"type":"human","role":"user","content":"Read file1.txt"}',
        '',
        '{invalid line}',
        '{"type":"assistant","role":"assistant","content":"Content of file1.txt"}',
      ].join('\n')

      writeFileSync(TEST_FILE, content, 'utf-8')

      const transcript = parseTranscript(TEST_FILE)
      const messages = transcriptToMessages(transcript)

      expect(messages).toHaveLength(4)
      expect(messages[0].message.role).toBe('user')
      expect(messages[0].message.content).toBe('List files')

      expect(messages[1].message.role).toBe('assistant')
      expect(messages[1].message.content).toEqual(['text', 'file1.txt\nfile2.txt'])

      expect(messages[2].message.role).toBe('user')
      expect(messages[2].message.content).toBe('Read file1.txt')

      expect(messages[3].message.role).toBe('assistant')
      expect(messages[3].message.content).toBe('Content of file1.txt')
    })
  })
})
