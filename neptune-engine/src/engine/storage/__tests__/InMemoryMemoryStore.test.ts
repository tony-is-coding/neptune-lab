import { describe, expect, test, beforeEach } from 'bun:test'
import { InMemoryMemoryStore } from '../InMemoryMemoryStore'
import type { IMemoryStore } from '../IMemoryStore'

describe('InMemoryMemoryStore', () => {
  let store: IMemoryStore

  beforeEach(() => {
    store = new InMemoryMemoryStore()
  })

  describe('基本 CRUD', () => {
    test('应该保存和加载值', async () => {
      await store.save('user1', 'key1', 'value1')
      const value = await store.load('user1', 'key1')
      expect(value).toBe('value1')
    })

    test('应该保存复杂对象', async () => {
      const complexValue = { nested: { data: [1, 2, 3] } }
      await store.save('user1', 'complex', complexValue)
      const value = await store.load('user1', 'complex')
      expect(value).toEqual(complexValue)
    })

    test('应该覆盖已存在的键', async () => {
      await store.save('user1', 'key1', 'value1')
      await store.save('user1', 'key1', 'value2')
      const value = await store.load('user1', 'key1')
      expect(value).toBe('value2')
    })

    test('应该删除键', async () => {
      await store.save('user1', 'key1', 'value1')
      await store.delete('user1', 'key1')
      const value = await store.load('user1', 'key1')
      expect(value).toBeUndefined()
    })

    test('删除不存在的键不应该报错', async () => {
      // 直接调用，不应该抛出异常
      await store.delete('user1', 'nonexistent')
      // 验证可以继续正常操作
      await store.save('user1', 'key1', 'value1')
      const value = await store.load('user1', 'key1')
      expect(value).toBe('value1')
    })
  })

  describe('用户隔离', () => {
    test('不同用户的数据应该隔离', async () => {
      await store.save('user1', 'key1', 'value1')
      await store.save('user2', 'key1', 'value2')

      const value1 = await store.load('user1', 'key1')
      const value2 = await store.load('user2', 'key1')

      expect(value1).toBe('value1')
      expect(value2).toBe('value2')
    })

    test('一个用户的删除不应该影响另一个用户', async () => {
      await store.save('user1', 'key1', 'value1')
      await store.save('user2', 'key1', 'value2')

      await store.delete('user1', 'key1')

      const value1 = await store.load('user1', 'key1')
      const value2 = await store.load('user2', 'key1')

      expect(value1).toBeUndefined()
      expect(value2).toBe('value2')
    })

    test('clear 应该只清除指定用户的数据', async () => {
      await store.save('user1', 'key1', 'value1')
      await store.save('user2', 'key1', 'value2')

      await store.clear('user1')

      const value1 = await store.load('user1', 'key1')
      const value2 = await store.load('user2', 'key1')

      expect(value1).toBeUndefined()
      expect(value2).toBe('value2')
    })
  })

  describe('list 操作', () => {
    beforeEach(async () => {
      await store.save('user1', 'prefix:key1', 'value1')
      await store.save('user1', 'prefix:key2', 'value2')
      await store.save('user1', 'other:key3', 'value3')
      await store.save('user2', 'prefix:key1', 'value4')
    })

    test('应该列出所有键值对', async () => {
      const result = await store.list('user1')
      expect(result).toHaveLength(3)
      expect(result).toContainEqual({ key: 'prefix:key1', value: 'value1' })
      expect(result).toContainEqual({ key: 'prefix:key2', value: 'value2' })
      expect(result).toContainEqual({ key: 'other:key3', value: 'value3' })
    })

    test('应该支持前缀过滤', async () => {
      const result = await store.list('user1', 'prefix:')
      expect(result).toHaveLength(2)
      expect(result).toContainEqual({ key: 'prefix:key1', value: 'value1' })
      expect(result).toContainEqual({ key: 'prefix:key2', value: 'value2' })
    })

    test('前缀过滤应该只返回匹配的键', async () => {
      const result = await store.list('user1', 'other:')
      expect(result).toHaveLength(1)
      expect(result).toContainEqual({ key: 'other:key3', value: 'value3' })
    })

    test('list 应该按用户隔离', async () => {
      const result1 = await store.list('user1', 'prefix:')
      const result2 = await store.list('user2', 'prefix:')

      expect(result1).toHaveLength(2)
      expect(result2).toHaveLength(1)
      expect(result1).toContainEqual({ key: 'prefix:key1', value: 'value1' })
      expect(result2).toContainEqual({ key: 'prefix:key1', value: 'value4' })
    })

    test('不存在的用户应该返回空数组', async () => {
      const result = await store.list('nonexistent')
      expect(result).toEqual([])
    })

    test('不匹配的前缀应该返回空数组', async () => {
      const result = await store.list('user1', 'noprefix:')
      expect(result).toEqual([])
    })
  })

  describe('dispose', () => {
    test('dispose 应该清理所有数据', async () => {
      await store.save('user1', 'key1', 'value1')
      await store.save('user2', 'key2', 'value2')

      await store.dispose()

      const value1 = await store.load('user1', 'key1')
      const value2 = await store.load('user2', 'key2')

      expect(value1).toBeUndefined()
      expect(value2).toBeUndefined()
    })

    test('dispose 后可以继续使用（重新初始化）', async () => {
      await store.save('user1', 'key1', 'value1')
      await store.dispose()

      // dispose 后可以继续保存新数据
      await store.save('user1', 'key2', 'value2')
      const value = await store.load('user1', 'key2')
      expect(value).toBe('value2')
    })
  })

  describe('边界情况', () => {
    test('应该处理空字符串键', async () => {
      await store.save('user1', '', 'empty-key-value')
      const value = await store.load('user1', '')
      expect(value).toBe('empty-key-value')
    })

    test('应该处理特殊字符键', async () => {
      const specialKey = 'key:with/special#chars'
      await store.save('user1', specialKey, 'special-value')
      const value = await store.load('user1', specialKey)
      expect(value).toBe('special-value')
    })

    test('应该处理 null 和 undefined 值', async () => {
      await store.save('user1', 'null-key', null)
      await store.save('user1', 'undefined-key', undefined)

      const nullValue = await store.load('user1', 'null-key')
      const undefinedValue = await store.load('user1', 'undefined-key')

      expect(nullValue).toBeNull()
      expect(undefinedValue).toBeUndefined()
    })

    test('应该处理大量数据', async () => {
      const count = 1000
      const promises: Promise<void>[] = []

      for (let i = 0; i < count; i++) {
        promises.push(store.save('user1', `key${i}`, `value${i}`))
      }

      await Promise.all(promises)

      const result = await store.list('user1')
      expect(result).toHaveLength(count)
    })
  })
})
