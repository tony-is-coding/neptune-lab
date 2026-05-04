import { describe, test, expect, beforeEach } from 'bun:test'
import { CompositeBackend } from '../CompositeBackend'
import { InMemoryBackend } from '../InMemoryBackend'
import { EngineError, EngineErrorCode } from '../../errors'

describe('CompositeBackend', () => {
  let userBackend: InMemoryBackend<string>
  let sessionBackend: InMemoryBackend<string>
  let defaultBackend: InMemoryBackend<string>
  let composite: CompositeBackend<string>

  beforeEach(() => {
    userBackend = new InMemoryBackend<string>()
    sessionBackend = new InMemoryBackend<string>()
    defaultBackend = new InMemoryBackend<string>()

    composite = new CompositeBackend<string>({
      routes: [
        { prefix: 'user:', backend: userBackend },
        { prefix: 'session:', backend: sessionBackend },
      ],
      default: defaultBackend,
    })
  })

  describe('路由规则', () => {
    test('根据前缀路由到正确的后端', async () => {
      await composite.write('user:1', 'Alice')
      await composite.write('session:1', 'S1')
      await composite.write('other', 'O1')

      expect(await composite.read('user:1')).toBe('Alice')
      expect(await composite.read('session:1')).toBe('S1')
      expect(await composite.read('other')).toBe('O1')
    })

    test('长前缀优先匹配', async () => {
      const specificBackend = new InMemoryBackend<string>()
      const generalBackend = new InMemoryBackend<string>()

      const compositeWithLongPrefix = new CompositeBackend<string>({
        routes: [
          { prefix: 'user:admin:', backend: specificBackend },
          { prefix: 'user:', backend: generalBackend },
        ],
      })

      await compositeWithLongPrefix.write('user:admin:1', 'Admin')
      await compositeWithLongPrefix.write('user:1', 'User')

      expect(await specificBackend.read('user:admin:1')).toBe('Admin')
      expect(await generalBackend.read('user:1')).toBe('User')
      expect(await specificBackend.read('user:1')).toBeNull()
    })

    test('未匹配的 key 路由到默认后端', async () => {
      await composite.write('unmatched', 'value')

      expect(await defaultBackend.read('unmatched')).toBe('value')
      expect(await userBackend.has('unmatched')).toBe(false)
      expect(await sessionBackend.has('unmatched')).toBe(false)
    })

    test('没有默认后端时，未匹配的 key read 返回 null', async () => {
      const compositeWithoutDefault = new CompositeBackend<string>({
        routes: [{ prefix: 'user:', backend: userBackend }],
      })

      const value = await compositeWithoutDefault.read('unmatched')
      expect(value).toBeNull()
    })

    test('没有默认后端时，未匹配的 key write 抛出错误', async () => {
      const compositeWithoutDefault = new CompositeBackend<string>({
        routes: [{ prefix: 'user:', backend: userBackend }],
      })

      await expect(compositeWithoutDefault.write('unmatched', 'value')).rejects.toThrow()
    })

    test('没有默认后端时，未匹配的 key write 抛出 CONFIGURATION_ERROR', async () => {
      const compositeWithoutDefault = new CompositeBackend<string>({
        routes: [{ prefix: 'user:', backend: userBackend }],
      })

      try {
        await compositeWithoutDefault.write('unmatched', 'value')
        expect.fail('应该抛出错误')
      } catch (error) {
        expect(error).toBeInstanceOf(EngineError)
        expect((error as EngineError).code).toBe(EngineErrorCode.CONFIGURATION_ERROR)
      }
    })
  })

  describe('list 操作', () => {
    test('无前缀时返回所有后端的值', async () => {
      await composite.write('user:1', 'Alice')
      await composite.write('user:2', 'Bob')
      await composite.write('session:1', 'S1')
      await composite.write('session:2', 'S2')
      await composite.write('other', 'O1')

      const values = await composite.list()
      expect(values).toHaveLength(5)
      expect(values).toContain('Alice')
      expect(values).toContain('Bob')
      expect(values).toContain('S1')
      expect(values).toContain('S2')
      expect(values).toContain('O1')
    })

    test('有前缀时只返回匹配后端的值', async () => {
      await composite.write('user:1', 'Alice')
      await composite.write('user:2', 'Bob')
      await composite.write('session:1', 'S1')
      await composite.write('other', 'O1')

      const userValues = await composite.list('user:')
      expect(userValues).toHaveLength(2)
      expect(userValues).toContain('Alice')
      expect(userValues).toContain('Bob')
      expect(userValues).not.toContain('S1')
      expect(userValues).not.toContain('O1')
    })

    test('空存储时返回空数组', async () => {
      const values = await composite.list()
      expect(values).toHaveLength(0)
    })
  })

  describe('delete 操作', () => {
    test('删除匹配后端的 key', async () => {
      await composite.write('user:1', 'Alice')
      await composite.delete('user:1')

      expect(await composite.read('user:1')).toBeNull()
    })

    test('删除不存在的 key 不报错', async () => {
      const result = composite.delete('user:nonexistent')
      await expect(result).resolves.toBeUndefined()
    })

    test('删除未匹配的 key 静默成功', async () => {
      const compositeWithoutDefault = new CompositeBackend<string>({
        routes: [{ prefix: 'user:', backend: userBackend }],
      })

      const result = compositeWithoutDefault.delete('unmatched')
      await expect(result).resolves.toBeUndefined()
    })
  })

  describe('dispose 操作', () => {
    test('释放所有后端', async () => {
      await composite.write('user:1', 'Alice')
      await composite.write('session:1', 'S1')
      await composite.write('other', 'O1')

      await composite.dispose()

      // 所有后端都应该被释放
      await expect(userBackend.read('user:1')).rejects.toThrow()
      await expect(sessionBackend.read('session:1')).rejects.toThrow()
      await expect(defaultBackend.read('other')).rejects.toThrow()
    })

    test('没有默认后端时也能正常释放', async () => {
      const compositeWithoutDefault = new CompositeBackend<string>({
        routes: [{ prefix: 'user:', backend: userBackend }],
      })

      await compositeWithoutDefault.dispose()
      await expect(userBackend.read('user:1')).rejects.toThrow()
    })
  })

  describe('降级行为', () => {
    test('单个后端失败不影响其他后端（read）', async () => {
      const failingBackend = new InMemoryBackend<string>()
      const workingBackend = new InMemoryBackend<string>()

      let shouldFail = false
      const originalRead = failingBackend.read.bind(failingBackend)
      failingBackend.read = async (key: string) => {
        if (shouldFail) {
          throw new Error('Backend failed')
        }
        return originalRead(key)
      }

      const compositeWithFailing = new CompositeBackend<string>({
        routes: [
          { prefix: 'fail:', backend: failingBackend },
          { prefix: 'work:', backend: workingBackend },
        ],
      })

      await compositeWithFailing.write('fail:1', 'F1')
      await compositeWithFailing.write('work:1', 'W1')

      shouldFail = true

      // working 后端应该仍然可用
      expect(await compositeWithFailing.read('work:1')).toBe('W1')
    })

    test('list 操作聚合所有后端的结果', async () => {
      await composite.write('user:1', 'Alice')
      await composite.write('user:2', 'Bob')
      await composite.write('session:1', 'S1')
      await composite.write('other', 'O1')

      const values = await composite.list()
      const sortedValues = values.sort()

      expect(sortedValues).toEqual(['Alice', 'Bob', 'O1', 'S1'])
    })
  })

  describe('边界条件', () => {
    test('空前缀字符串', async () => {
      await composite.write('user:1', 'Alice')

      const values = await composite.list('')
      expect(values).toContain('Alice')
    })

    test('重复的前缀（后注册的覆盖）', async () => {
      const backend1 = new InMemoryBackend<string>()
      const backend2 = new InMemoryBackend<string>()

      const compositeWithDup = new CompositeBackend<string>({
        routes: [
          { prefix: 'same:', backend: backend1 },
          { prefix: 'same:', backend: backend2 },
        ],
      })

      await compositeWithDup.write('same:key', 'value')

      // 后注册的 backend2 应该被使用（因为排序后它在前面）
      expect(await backend1.read('same:key')).toBe('value')
      expect(await backend2.read('same:key')).toBeNull()
    })
  })
})
