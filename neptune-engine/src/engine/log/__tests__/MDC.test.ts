/**
 * MDC 单元测试
 *
 * 测试覆盖：
 * - run() 创建异步上下文
 * - getContext() 获取当前上下文
 * - put() 设置字段
 * - get() 获取字段
 * - clear() 清除上下文
 * - 嵌套作用域
 * - 非作用域 put/get 静默失败
 * - generateRequestId()
 */

import { describe, test, expect } from 'bun:test'
import { MDC } from '../MDC'

describe('MDC', () => {
  describe('run() 和 getContext()', () => {
    test('run 应该创建新的上下文作用域', async () => {
      const context = { sessionId: 'test-123', requestId: 'req-456' }

      await MDC.run(context, async () => {
        const retrieved = MDC.getContext()
        expect(retrieved).toEqual(context)
      })
    })

    test('run 作用域外应该返回空对象', () => {
      const retrieved = MDC.getContext()
      expect(retrieved).toEqual({})
    })

    test('嵌套 run 作用域应该正确隔离', async () => {
      const outerContext = { sessionId: 'outer' }
      const innerContext = { requestId: 'inner' }

      await MDC.run(outerContext, async () => {
        expect(MDC.getContext()).toEqual(outerContext)

        await MDC.run(innerContext, async () => {
          const retrieved = MDC.getContext()
          expect(retrieved).toEqual(innerContext)
        })

        // 内层作用域结束后，应该恢复外层上下文
        expect(MDC.getContext()).toEqual(outerContext)
      })
    })

    test('run 应该返回回调函数的返回值', async () => {
      const result = await MDC.run({}, async () => {
        return 'test-result'
      })

      expect(result).toBe('test-result')
    })
  })

  describe('put() 和 get()', () => {
    test('put 应该在作用域内设置字段', async () => {
      await MDC.run({}, async () => {
        MDC.put('customField', 'customValue')

        const retrieved = MDC.get('customField')
        expect(retrieved).toBe('customValue')
      })
    })

    test('get 应该获取字段值', async () => {
      await MDC.run({ existingField: 'existingValue' }, async () => {
        const retrieved = MDC.get('existingField')
        expect(retrieved).toBe('existingValue')
      })
    })

    test('get 不存在的字段应该返回 undefined', async () => {
      await MDC.run({}, async () => {
        const retrieved = MDC.get('nonExistent')
        expect(retrieved).toBeUndefined()
      })
    })

    test('非作用域内 put 应该静默失败', () => {
      // 不应该抛出错误
      expect(() => {
        MDC.put('key', 'value')
      }).not.toThrow()
    })

    test('非作用域内 get 应该返回 undefined', () => {
      const retrieved = MDC.get('key')
      expect(retrieved).toBeUndefined()
    })
  })

  describe('clear()', () => {
    test('clear 应该清除上下文的所有字段', async () => {
      await MDC.run(
        { field1: 'value1', field2: 'value2', field3: 'value3' },
        async () => {
          MDC.clear()

          const retrieved = MDC.getContext()
          expect(retrieved).toEqual({})
        },
      )
    })

    test('clear 后应该能重新设置字段', async () => {
      await MDC.run({ field1: 'value1' }, async () => {
        MDC.clear()
        MDC.put('field2', 'value2')

        const retrieved = MDC.get('field2')
        expect(retrieved).toBe('value2')
      })
    })
  })

  describe('generateRequestId()', () => {
    test('应该生成符合格式的 Request ID', () => {
      const id = MDC.generateRequestId()
      expect(id).toMatch(/^req-\d+-[a-z0-9]+$/)
    })

    test('每次生成应该返回不同的 ID', () => {
      const id1 = MDC.generateRequestId()
      const id2 = MDC.generateRequestId()

      expect(id1).not.toBe(id2)
    })

    test('生成的 ID 应该包含时间戳', () => {
      const before = Date.now()
      const id = MDC.generateRequestId()
      const after = Date.now()

      const match = id.match(/^req-(\d+)-/)
      const timestamp = match ? parseInt(match[1], 10) : 0

      expect(timestamp).toBeGreaterThanOrEqual(before)
      expect(timestamp).toBeLessThanOrEqual(after)
    })
  })

  describe('复杂场景', () => {
    test('嵌套作用域中修改上下文应该不影响外层', async () => {
      await MDC.run({ sessionId: 'outer' }, async () => {
        await MDC.run({ requestId: 'inner' }, async () => {
          MDC.put('modified', 'inner-value')
          expect(MDC.get('modified')).toBe('inner-value')
        })

        // 外层不应该看到内层的修改
        expect(MDC.get('modified')).toBeUndefined()
        expect(MDC.getContext()).toEqual({ sessionId: 'outer' })
      })
    })

    test('多个字段应该正确传递', async () => {
      const context = {
        sessionId: 'session-123',
        requestId: 'req-456',
        userId: 'user-789',
        customField: 'custom-value',
      }

      await MDC.run(context, async () => {
        expect(MDC.get('sessionId')).toBe('session-123')
        expect(MDC.get('requestId')).toBe('req-456')
        expect(MDC.get('userId')).toBe('user-789')
        expect(MDC.get('customField')).toBe('custom-value')
      })
    })
  })
})
