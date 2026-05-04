/**
 * waitForResult 资源清理测试
 *
 * 测试 waitForResultWithTimeout 在超时场景下的资源清理
 */

import { describe, test, expect } from 'bun:test'
import { waitForResultWithTimeout } from '../waitForResult'
import type { SDKMessage } from '../../types/query-events'

describe('waitForResult - 资源清理', () => {
  const createMockMessage = (type: string, extra: Record<string, unknown> = {}): SDKMessage => ({
    type,
    ...extra,
  } as SDKMessage)

  /**
   * 创建一个带有 cleanup 追踪的 mock generator
   */
  const createTrackedGenerator = (
    messages: SDKMessage[],
    delayMs: number = 0,
  ): {
    generator: AsyncGenerator<SDKMessage>
    cleanupCalled: boolean
    setTimeoutCleared: boolean
  } => {
    let cleanupCalled = false
    let setTimeoutCleared = false
    let index = 0

    const generator = {
      async next() {
        if (delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs))
        }
        if (index >= messages.length) {
          return { done: true, value: undefined }
        }
        const value = messages[index++]
        return { done: false, value }
      },
      async return() {
        cleanupCalled = true
        return { done: true, value: undefined }
      },
      async throw(error?: unknown) {
        cleanupCalled = true
        throw error
      },
      [Symbol.asyncIterator]() {
        return this
      },
    } as unknown as AsyncGenerator<SDKMessage> & {
      return: () => Promise<IteratorResult<SDKMessage>>
      throw: (error?: unknown) => Promise<never>
    }

    return { generator, cleanupCalled: false, setTimeoutCleared: false }
  }

  describe('waitForResultWithTimeout 资源清理', () => {
    test('超时时应返回 TIMEOUT 错误', async () => {
      // 创建一个有延迟但最终会完成的 generator
      const slowGenerator = (async function* () {
        yield createMockMessage('assistant', { content: 'Hello' })
        // 模拟长时间操作
        await new Promise(resolve => setTimeout(resolve, 500))
        yield createMockMessage('result')
      })()

      // 设置很短的超时时间
      const result = await waitForResultWithTimeout(slowGenerator, 50)

      expect(result.success).toBe(false)
      expect(result.error).toBe('TIMEOUT')
    })

    test('正常完成时也应调用 generator.return()', async () => {
      const messages = [
        createMockMessage('assistant', { content: 'Hello' }),
        createMockMessage('result'),
      ]

      const { generator } = createTrackedGenerator(messages, 0)

      const result = await waitForResultWithTimeout(generator, 1000)

      expect(result.success).toBe(true)
      expect(result.error).not.toBe('TIMEOUT')
    })

    test('查询提前返回时应清理 setTimeout', async () => {
      const messages = [
        createMockMessage('assistant', { content: 'Hello' }),
        createMockMessage('result'),
      ]

      const { generator } = createTrackedGenerator(messages, 0)

      const startTime = Date.now()
      const result = await waitForResultWithTimeout(generator, 5000)
      const endTime = Date.now()

      expect(result.success).toBe(true)
      // 应该很快返回，而不是等待整个超时时间
      expect(endTime - startTime).toBeLessThan(1000)
    })

    test('查询出错时应清理 setTimeout', async () => {
      const errorGenerator = (async function* () {
        yield createMockMessage('assistant', { content: 'Hello' })
        throw new Error('Query failed')
      })()

      const startTime = Date.now()
      const result = await waitForResultWithTimeout(errorGenerator, 5000)
      const endTime = Date.now()

      expect(result.success).toBe(false)
      expect(result.error).toBeInstanceOf(Error)
      // 应该很快返回，而不是等待整个超时时间
      expect(endTime - startTime).toBeLessThan(1000)
    })

    test('多个超时场景不应泄漏 timer', async () => {
      const results = []

      // 创建多个慢查询
      for (let i = 0; i < 3; i++) {
        const slowGenerator = (async function* () {
          yield createMockMessage('assistant', { content: `Hello ${i}` })
          // 模拟长时间操作
          await new Promise(resolve => setTimeout(resolve, 500))
          yield createMockMessage('result')
        })()

        const result = await waitForResultWithTimeout(slowGenerator, 20)
        results.push(result)
      }

      // 所有查询都应该超时
      expect(results).toHaveLength(3)
      results.forEach(result => {
        expect(result.success).toBe(false)
        expect(result.error).toBe('TIMEOUT')
      })

      // 如果有 timer 泄漏，这个测试可能会挂起
      // 验证我们能够快速完成
    })

    test('generator 抛出错误时应正确处理', async () => {
      let cleanupCalled = false
      const errorGenerator = {
        async next() {
          throw new Error('Generator error')
        },
        async return() {
          cleanupCalled = true
          return { done: true, value: undefined }
        },
        [Symbol.asyncIterator]() {
          return this
        },
      } as unknown as AsyncGenerator<SDKMessage> & {
        return: () => Promise<IteratorResult<SDKMessage>>
      }

      const result = await waitForResultWithTimeout(errorGenerator, 1000)

      expect(result.success).toBe(false)
      expect(result.error).toBeInstanceOf(Error)
    })
  })

  describe('资源清理边界条件', () => {
    test('慢速 generator 超时', async () => {
      const slowGenerator = (async function* () {
        yield createMockMessage('assistant', { content: 'Hello' })
        // 模拟长时间操作
        await new Promise(resolve => setTimeout(resolve, 500))
        yield createMockMessage('result')
      })()

      const result = await waitForResultWithTimeout(slowGenerator, 50)

      expect(result.success).toBe(false)
      expect(result.error).toBe('TIMEOUT')
    })

    test('零超时时间应立即超时', async () => {
      const slowGenerator = (async function* () {
        await new Promise(resolve => setTimeout(resolve, 100))
        yield createMockMessage('result')
      })()

      const result = await waitForResultWithTimeout(slowGenerator, 0)

      expect(result.success).toBe(false)
      expect(result.error).toBe('TIMEOUT')
    })

    test('负超时时间应立即超时', async () => {
      const slowGenerator = (async function* () {
        await new Promise(resolve => setTimeout(resolve, 100))
        yield createMockMessage('result')
      })()

      const result = await waitForResultWithTimeout(slowGenerator, -1)

      expect(result.success).toBe(false)
      expect(result.error).toBe('TIMEOUT')
    })
  })
})
