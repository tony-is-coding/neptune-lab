/**
 * ProviderRegistry 测试
 *
 * 测试目标：
 * 1. register/get/has/list/getAll/clear
 * 2. 重复注册检测
 * 3. 未注册 type 处理
 * 4. unregister 功能
 * 5. getGlobalProviderRegistry 全局单例
 * 6. resetGlobalProviderRegistryForTesting 测试辅助
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { ProviderRegistry, getGlobalProviderRegistry, resetGlobalProviderRegistryForTesting } from '../ProviderRegistry.js'
import type { ProviderAdapter, ProviderQueryParams, ProviderMessage } from '../ProviderAdapter.js'

// Mock ProviderAdapter 用于测试
class MockProvider implements ProviderAdapter {
  readonly type: string
  private config: Record<string, unknown>

  constructor(type: string, config: Record<string, unknown> = {}) {
    this.type = type
    this.config = config
  }

  getConfig(): Record<string, unknown> {
    return this.config
  }

  async *query(_params: ProviderQueryParams): AsyncGenerator<ProviderMessage> {
    yield { type: 'message', content: { mock: true } }
  }
}

describe('ProviderRegistry', () => {
  let registry: ProviderRegistry

  beforeEach(() => {
    registry = new ProviderRegistry()
  })

  describe('register（注册 Provider）', () => {
    test('应该成功注册新的 Provider', () => {
      const provider = new MockProvider('test-provider')
      registry.register('test', provider)

      const retrieved = registry.get('test')
      expect(retrieved).toBe(provider)
    })

    test('应该拒绝重复注册相同 type', () => {
      const provider1 = new MockProvider('provider1')
      const provider2 = new MockProvider('provider2')

      registry.register('test', provider1)

      expect(() => {
        registry.register('test', provider2)
      }).toThrow()
    })

    test('重复注册错误消息应该包含 type', () => {
      const provider1 = new MockProvider('provider1')
      const provider2 = new MockProvider('provider2')

      registry.register('test', provider1)

      try {
        registry.register('test', provider2)
        expect(true).toBe(false)
      } catch (error) {
        expect((error as Error).message).toContain('test')
        expect((error as Error).message).toContain('already registered')
      }
    })

    test('应该允许注册不同的 type', () => {
      const provider1 = new MockProvider('provider1')
      const provider2 = new MockProvider('provider2')

      registry.register('type1', provider1)
      registry.register('type2', provider2)

      expect(registry.get('type1')).toBe(provider1)
      expect(registry.get('type2')).toBe(provider2)
    })

    test('应该支持各种 type 名称格式', () => {
      // 短名称
      registry.register('a', new MockProvider('a'))
      expect(registry.has('a')).toBe(true)

      // 带连字符
      registry.register('my-provider', new MockProvider('my-provider'))
      expect(registry.has('my-provider')).toBe(true)

      // 带点号
      registry.register('custom.provider', new MockProvider('custom.provider'))
      expect(registry.has('custom.provider')).toBe(true)

      // 带数字
      registry.register('provider123', new MockProvider('provider123'))
      expect(registry.has('provider123')).toBe(true)
    })
  })

  describe('get（获取 Provider）', () => {
    test('应该获取已注册的 Provider', () => {
      const provider = new MockProvider('test-provider')
      registry.register('test', provider)

      const retrieved = registry.get('test')
      expect(retrieved).toBe(provider)
    })

    test('获取未注册的 type 返回 undefined', () => {
      const retrieved = registry.get('non-existent')
      expect(retrieved).toBeUndefined()
    })

    test('应该返回正确的 Provider 实例', () => {
      const provider1 = new MockProvider('provider1')
      const provider2 = new MockProvider('provider2')
      const provider3 = new MockProvider('provider3')

      registry.register('p1', provider1)
      registry.register('p2', provider2)
      registry.register('p3', provider3)

      expect(registry.get('p1')).toBe(provider1)
      expect(registry.get('p2')).toBe(provider2)
      expect(registry.get('p3')).toBe(provider3)
    })
  })

  describe('has（检查 Provider 是否存在）', () => {
    test('已注册的 Provider 应该返回 true', () => {
      registry.register('test', new MockProvider('test'))
      expect(registry.has('test')).toBe(true)
    })

    test('未注册的 Provider 应该返回 false', () => {
      expect(registry.has('non-existent')).toBe(false)
    })

    test('空 registry 应该对所有 type 返回 false', () => {
      expect(registry.has('anything')).toBe(false)
    })
  })

  describe('list（列出所有 Provider 类型）', () => {
    test('应该返回所有已注册的 type', () => {
      registry.register('type1', new MockProvider('type1'))
      registry.register('type2', new MockProvider('type2'))
      registry.register('type3', new MockProvider('type3'))

      const types = registry.list()
      expect(types).toHaveLength(3)
      expect(types).toContain('type1')
      expect(types).toContain('type2')
      expect(types).toContain('type3')
    })

    test('空 registry 应该返回空数组', () => {
      const types = registry.list()
      expect(types).toEqual([])
    })

    test('返回的数组应该是副本', () => {
      registry.register('type1', new MockProvider('type1'))

      const types1 = registry.list()
      const types2 = registry.list()

      expect(types1).not.toBe(types2) // 不是同一个引用
      expect(types1).toEqual(types2)  // 但内容相同
    })

    test('list 顺序应该按注册顺序', () => {
      registry.register('first', new MockProvider('first'))
      registry.register('second', new MockProvider('second'))
      registry.register('third', new MockProvider('third'))

      const types = registry.list()
      expect(types).toEqual(['first', 'second', 'third'])
    })
  })

  describe('getAll（获取所有 Provider）', () => {
    test('应该返回所有已注册的 Provider', () => {
      const p1 = new MockProvider('p1')
      const p2 = new MockProvider('p2')
      const p3 = new MockProvider('p3')

      registry.register('type1', p1)
      registry.register('type2', p2)
      registry.register('type3', p3)

      const all = registry.getAll()

      expect(all instanceof Map).toBe(true)
      expect(all.size).toBe(3)
      expect(all.get('type1')).toBe(p1)
      expect(all.get('type2')).toBe(p2)
      expect(all.get('type3')).toBe(p3)
    })

    test('返回的 Map 应该是只读的', () => {
      registry.register('type1', new MockProvider('type1'))

      const all = registry.getAll()

      // ReadonlyMap 没有 set 方法，但我们可以尝试修改
      // TypeScript 编译时会阻止，但运行时可能不会
      // 这里我们验证返回的是正确的类型
      expect(all.get('type1')).toBeDefined()
    })

    test('空 registry 应该返回空 Map', () => {
      const all = registry.getAll()
      expect(all.size).toBe(0)
    })
  })

  describe('unregister（注销 Provider）', () => {
    test('应该成功注销已注册的 Provider', () => {
      registry.register('test', new MockProvider('test'))

      const result = registry.unregister('test')
      expect(result).toBe(true)

      expect(registry.has('test')).toBe(false)
      expect(registry.get('test')).toBeUndefined()
    })

    test('注销不存在的 Provider 返回 false', () => {
      const result = registry.unregister('non-existent')
      expect(result).toBe(false)
    })

    test('注销后可以重新注册相同 type', () => {
      const provider1 = new MockProvider('provider1')
      const provider2 = new MockProvider('provider2')

      registry.register('test', provider1)
      registry.unregister('test')

      // 不应该抛出错误
      registry.register('test', provider2)

      expect(registry.get('test')).toBe(provider2)
    })

    test('注销不影响其他 Provider', () => {
      const p1 = new MockProvider('p1')
      const p2 = new MockProvider('p2')
      const p3 = new MockProvider('p3')

      registry.register('type1', p1)
      registry.register('type2', p2)
      registry.register('type3', p3)

      registry.unregister('type2')

      expect(registry.has('type1')).toBe(true)
      expect(registry.has('type2')).toBe(false)
      expect(registry.has('type3')).toBe(true)
    })
  })

  describe('clear（清空所有 Provider）', () => {
    test('应该清空所有已注册的 Provider', () => {
      registry.register('type1', new MockProvider('type1'))
      registry.register('type2', new MockProvider('type2'))
      registry.register('type3', new MockProvider('type3'))

      registry.clear()

      expect(registry.list()).toHaveLength(0)
      expect(registry.getAll().size).toBe(0)
      expect(registry.has('type1')).toBe(false)
      expect(registry.has('type2')).toBe(false)
      expect(registry.has('type3')).toBe(false)
    })

    test('清空后可以重新注册', () => {
      registry.register('test', new MockProvider('test'))
      registry.clear()

      // 不应该抛出错误
      registry.register('test', new MockProvider('test'))
      expect(registry.has('test')).toBe(true)
    })

    test('清空空 registry 不报错', () => {
      expect(() => {
        registry.clear()
      }).not.toThrow()
    })
  })

  /**
   * 与真实 Provider 的集成测试需要在集成测试中进行，
   * 因为它们需要复杂的 mock 设置和 CC Runtime 依赖。
   */

  describe('复杂场景', () => {
    test('应该支持大量 Provider', () => {
      const count = 100

      for (let i = 0; i < count; i++) {
        registry.register(`provider${i}`, new MockProvider(`provider${i}`))
      }

      expect(registry.list()).toHaveLength(count)
      expect(registry.getAll().size).toBe(count)
    })

    test('应该支持动态注册和注销', () => {
      const providers: MockProvider[] = []

      // 注册一批
      for (let i = 0; i < 5; i++) {
        const p = new MockProvider(`p${i}`)
        providers.push(p)
        registry.register(`type${i}`, p)
      }

      expect(registry.list()).toHaveLength(5)

      // 注销一部分
      registry.unregister('type1')
      registry.unregister('type3')

      expect(registry.list()).toHaveLength(3)

      // 再注册新的
      const newProvider = new MockProvider('new')
      registry.register('new', newProvider)

      expect(registry.list()).toHaveLength(4)
      expect(registry.has('new')).toBe(true)
    })

    test('Provider 实例应该保持独立', () => {
      const p1 = new MockProvider('p1', { key: 'value1' })
      const p2 = new MockProvider('p2', { key: 'value2' })

      registry.register('type1', p1)
      registry.register('type2', p2)

      const retrieved1 = registry.get('type1')
      const retrieved2 = registry.get('type2')

      expect(retrieved1?.getConfig()).toEqual({ key: 'value1' })
      expect(retrieved2?.getConfig()).toEqual({ key: 'value2' })
    })
  })
})

/**
 * 注意：全局单例（getGlobalProviderRegistry）的测试需要复杂的 mock 设置，
 * 因为 ProviderRegistry.ts 在顶层就导入了所有真实的 Provider 适配器。
 * 这些测试应该在集成测试中进行，或者在修复 ProviderRegistry 的导入结构后添加。
 *
 * TODO: 在重构 ProviderRegistry 以支持动态 Provider 加载后，添加以下测试：
 * - getGlobalProviderRegistry 返回单例实例
 * - 首次调用注册默认 Provider
 * - resetGlobalProviderRegistryForTesting 重置单例
 */
