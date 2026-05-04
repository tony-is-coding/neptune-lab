import { describe, expect, test, beforeEach } from 'bun:test'
import { InMemorySessionContentStore } from '../InMemorySessionContentStore'
import type { ISessionContentStore } from '../ISessionContentStore'

describe('InMemorySessionContentStore', () => {
  let store: ISessionContentStore

  beforeEach(() => {
    store = new InMemorySessionContentStore()
  })

  describe('基本操作', () => {
    test('应该追加和读取内容', async () => {
      await store.append('session1', 'content1')
      const items = await store.read('session1')
      expect(items).toHaveLength(1)
      expect(items[0].content).toBe('content1')
    })

    test('应该支持多次追加', async () => {
      await store.append('session1', 'content1')
      await store.append('session1', 'content2')
      await store.append('session1', 'content3')

      const items = await store.read('session1')
      expect(items).toHaveLength(3)
      expect(items[0].content).toBe('content1')
      expect(items[1].content).toBe('content2')
      expect(items[2].content).toBe('content3')
    })

    test('应该包含时间戳', async () => {
      const beforeAppend = Date.now()
      await store.append('session1', 'content1')
      const afterAppend = Date.now()

      const items = await store.read('session1')
      expect(items[0].timestamp).toBeGreaterThanOrEqual(beforeAppend)
      expect(items[0].timestamp).toBeLessThanOrEqual(afterAppend)
    })

    test('应该支持元数据', async () => {
      const metadata = { type: 'message', role: 'user' }
      await store.append('session1', 'content1', metadata)

      const items = await store.read('session1')
      expect(items[0].metadata).toEqual(metadata)
    })

    test('应该返回内容条数', async () => {
      await store.append('session1', 'content1')
      await store.append('session1', 'content2')

      const count = await store.count('session1')
      expect(count).toBe(2)
    })

    test('不存在的 session 应该返回 0', async () => {
      const count = await store.count('nonexistent')
      expect(count).toBe(0)
    })
  })

  describe('Session 隔离', () => {
    test('不同 session 的数据应该隔离', async () => {
      await store.append('session1', 'content1')
      await store.append('session2', 'content2')

      const items1 = await store.read('session1')
      const items2 = await store.read('session2')

      expect(items1).toHaveLength(1)
      expect(items2).toHaveLength(1)
      expect(items1[0].content).toBe('content1')
      expect(items2[0].content).toBe('content2')
    })

    test('clear 应该只清除指定 session', async () => {
      await store.append('session1', 'content1')
      await store.append('session2', 'content2')

      await store.clear('session1')

      const items1 = await store.read('session1')
      const items2 = await store.read('session2')

      expect(items1).toHaveLength(0)
      expect(items2).toHaveLength(1)
    })
  })

  describe('读取选项', () => {
    beforeEach(async () => {
      for (let i = 0; i < 10; i++) {
        await store.append('session1', `content${i}`)
      }
    })

    test('应该支持 from 选项', async () => {
      const items = await store.read('session1', { from: 5 })
      expect(items).toHaveLength(5)
      expect(items[0].content).toBe('content5')
    })

    test('应该支持 to 选项', async () => {
      const items = await store.read('session1', { to: 5 })
      expect(items).toHaveLength(5)
      expect(items[4].content).toBe('content4')
    })

    test('应该支持 from 和 to 组合', async () => {
      const items = await store.read('session1', { from: 3, to: 7 })
      expect(items).toHaveLength(4)
      expect(items[0].content).toBe('content3')
      expect(items[3].content).toBe('content6')
    })

    test('应该支持 limit 选项', async () => {
      const items = await store.read('session1', { limit: 3 })
      expect(items).toHaveLength(3)
      expect(items[0].content).toBe('content0')
      expect(items[2].content).toBe('content2')
    })

    test('应该支持 from 和 limit 组合', async () => {
      const items = await store.read('session1', { from: 5, limit: 2 })
      expect(items).toHaveLength(2)
      expect(items[0].content).toBe('content5')
      expect(items[1].content).toBe('content6')
    })

    test('from 超出范围应该返回空数组', async () => {
      const items = await store.read('session1', { from: 100 })
      expect(items).toHaveLength(0)
    })

    test('to 超出范围应该返回所有内容', async () => {
      const items = await store.read('session1', { to: 100 })
      expect(items).toHaveLength(10)
    })
  })

  describe('truncate 操作', () => {
    test('应该保留最后 N 条', async () => {
      for (let i = 0; i < 10; i++) {
        await store.append('session1', `content${i}`)
      }

      await store.truncate('session1', 5)

      const items = await store.read('session1')
      expect(items).toHaveLength(5)
      expect(items[0].content).toBe('content5')
      expect(items[4].content).toBe('content9')
    })

    test('keepLastN 大于现有条数不应该删除任何内容', async () => {
      await store.append('session1', 'content1')
      await store.append('session1', 'content2')

      await store.truncate('session1', 10)

      const items = await store.read('session1')
      expect(items).toHaveLength(2)
    })

    test('keepLastN 为 0 应该清空所有内容', async () => {
      for (let i = 0; i < 5; i++) {
        await store.append('session1', `content${i}`)
      }

      await store.truncate('session1', 0)

      const items = await store.read('session1')
      expect(items).toHaveLength(0)
    })

    test('truncate 不存在的 session 不应该报错', async () => {
      // 直接调用，不应该抛出异常
      await store.truncate('nonexistent', 5)
      // 验证可以继续正常操作
      await store.append('nonexistent', 'content1')
      const items = await store.read('nonexistent')
      expect(items).toHaveLength(1)
    })
  })

  describe('dispose', () => {
    test('dispose 应该清理所有数据', async () => {
      await store.append('session1', 'content1')
      await store.append('session2', 'content2')

      await store.dispose()

      const items1 = await store.read('session1')
      const items2 = await store.read('session2')

      expect(items1).toHaveLength(0)
      expect(items2).toHaveLength(0)
    })

    test('dispose 后可以继续使用（重新初始化）', async () => {
      await store.append('session1', 'content1')
      await store.dispose()

      await store.append('session1', 'content2')
      const items = await store.read('session1')
      expect(items).toHaveLength(1)
      expect(items[0].content).toBe('content2')
    })
  })

  describe('边界情况', () => {
    test('应该处理空字符串内容', async () => {
      await store.append('session1', '')
      const items = await store.read('session1')
      expect(items).toHaveLength(1)
      expect(items[0].content).toBe('')
    })

    test('应该处理大量内容', async () => {
      const count = 1000
      for (let i = 0; i < count; i++) {
        await store.append('session1', `content${i}`)
      }

      const itemCount = await store.count('session1')
      expect(itemCount).toBe(count)
    })

    test('应该处理特殊字符内容', async () => {
      const specialContent = '内容\nwith\tspecial\rchars'
      await store.append('session1', specialContent)
      const items = await store.read('session1')
      expect(items[0].content).toBe(specialContent)
    })
  })
})
