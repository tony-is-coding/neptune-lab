/**
 * JsonLogFormatter 单元测试
 *
 * 测试覆盖：
 * - JSON 输出格式正确
 * - timestamp 格式为 ISO 8601
 * - level 字段正确
 * - 可选字段（loggerName、callSite、attrs）按需添加
 * - 空 attrs 不输出
 */

import { describe, test, expect } from 'bun:test'
import { JsonLogFormatter } from '../JsonLogFormatter'
import type { LogRecord } from '../LogRecord'

describe('JsonLogFormatter', () => {
  const formatter = new JsonLogFormatter()

  describe('基本格式', () => {
    test('应该输出有效的 JSON', () => {
      const record: LogRecord = {
        level: 'info',
        timestamp: new Date('2024-01-01T00:00:00.000Z'),
        message: 'test message',
      }
      const formatted = formatter.format(record)

      expect(() => JSON.parse(formatted)).not.toThrow()
    })

    test('应该包含 level 字段', () => {
      const record: LogRecord = {
        level: 'info',
        timestamp: new Date(),
        message: 'test message',
      }
      const formatted = formatter.format(record)
      const parsed = JSON.parse(formatted)

      expect(parsed.level).toBe('info')
    })

    test('应该包含 timestamp 字段（ISO 8601 格式）', () => {
      const date = new Date('2024-01-01T12:30:45.123Z')
      const record: LogRecord = {
        level: 'info',
        timestamp: date,
        message: 'test message',
      }
      const formatted = formatter.format(record)
      const parsed = JSON.parse(formatted)

      expect(parsed.timestamp).toBe('2024-01-01T12:30:45.123Z')
    })

    test('应该包含 message 字段', () => {
      const record: LogRecord = {
        level: 'info',
        timestamp: new Date(),
        message: 'test message',
      }
      const formatted = formatter.format(record)
      const parsed = JSON.parse(formatted)

      expect(parsed.message).toBe('test message')
    })
  })

  describe('可选字段', () => {
    test('应该包含 loggerName 字段（如果存在）', () => {
      const record: LogRecord = {
        level: 'info',
        timestamp: new Date(),
        message: 'test message',
        loggerName: 'engine:session',
      }
      const formatted = formatter.format(record)
      const parsed = JSON.parse(formatted)

      expect(parsed.loggerName).toBe('engine:session')
    })

    test('应该包含 callSite 字段（如果存在）', () => {
      const record: LogRecord = {
        level: 'info',
        timestamp: new Date(),
        message: 'test message',
        callSite: {
          file: '/path/to/file.ts',
          line: 42,
          method: 'testFunction',
        },
      }
      const formatted = formatter.format(record)
      const parsed = JSON.parse(formatted)

      expect(parsed.callSite).toEqual({
        file: '/path/to/file.ts',
        line: 42,
      })
      // callSite 只包含 file 和 line，不包含 method
    })

    test('应该包含 attrs 字段（如果存在且非空）', () => {
      const record: LogRecord = {
        level: 'info',
        timestamp: new Date(),
        message: 'test message',
        attrs: {
          sessionId: 'abc-123',
          userId: 'user-456',
        },
      }
      const formatted = formatter.format(record)
      const parsed = JSON.parse(formatted)

      expect(parsed.attrs).toEqual({
        sessionId: 'abc-123',
        userId: 'user-456',
      })
    })

    test('空 attrs 对象不应该输出 attrs 字段', () => {
      const record: LogRecord = {
        level: 'info',
        timestamp: new Date(),
        message: 'test message',
        attrs: {},
      }
      const formatted = formatter.format(record)
      const parsed = JSON.parse(formatted)

      expect(parsed).not.toHaveProperty('attrs')
    })

    test('undefined attrs 不应该输出 attrs 字段', () => {
      const record: LogRecord = {
        level: 'info',
        timestamp: new Date(),
        message: 'test message',
        attrs: undefined,
      }
      const formatted = formatter.format(record)
      const parsed = JSON.parse(formatted)

      expect(parsed).not.toHaveProperty('attrs')
    })
  })

  describe('完整示例', () => {
    test('应该正确格式化完整的 LogRecord', () => {
      const record: LogRecord = {
        level: 'error',
        timestamp: new Date('2024-12-28T10:30:00.000Z'),
        message: 'An error occurred',
        loggerName: 'engine:session',
        callSite: {
          file: '/src/engine/Session.ts',
          line: 123,
          method: 'create',
        },
        attrs: {
          sessionId: 'session-123',
          error: 'Connection failed',
        },
      }
      const formatted = formatter.format(record)
      const parsed = JSON.parse(formatted)

      expect(parsed).toEqual({
        level: 'error',
        timestamp: '2024-12-28T10:30:00.000Z',
        message: 'An error occurred',
        loggerName: 'engine:session',
        callSite: {
          file: '/src/engine/Session.ts',
          line: 123,
        },
        attrs: {
          sessionId: 'session-123',
          error: 'Connection failed',
        },
      })
    })
  })
})
