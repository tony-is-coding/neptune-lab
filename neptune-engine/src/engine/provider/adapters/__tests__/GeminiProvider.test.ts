/**
 * GeminiProvider 测试
 *
 * 测试目标：
 * - 验证 GeminiProvider 的基本功能
 * - 验证 ProviderAdapter 接口实现
 */

import { describe, test, expect, beforeEach } from 'bun:test'
import { GeminiProvider } from '../GeminiProvider.js'
import type { ProviderQueryParams } from '../../ProviderAdapter.js'

describe('GeminiProvider', () => {
  let provider: GeminiProvider

  beforeEach(() => {
    provider = new GeminiProvider()
  })

  describe('基本属性', () => {
    test('type 应该是 "gemini"', () => {
      expect(provider.type).toBe('gemini')
    })

    test('getConfig 应该返回配置对象', () => {
      const config = provider.getConfig()
      expect(config).toBeDefined()
      expect(typeof config).toBe('object')
    })

    test('应该支持自定义配置', () => {
      const customProvider = new GeminiProvider({
        apiKey: 'test-api-key',
      })
      const config = customProvider.getConfig()
      expect(config.apiKey).toBe('test-api-key')
    })
  })

  describe('query 方法', () => {
    test('query 方法应该返回 AsyncGenerator', async () => {
      const params: ProviderQueryParams = {
        model: 'gemini-pro',
        messages: [],
      }

      const gen = provider.query(params)
      expect(gen).toBeDefined()
      expect(typeof gen[Symbol.asyncIterator]).toBe('function')
    })

    test('query 方法应该支持完整的参数', async () => {
      const params: ProviderQueryParams = {
        model: 'gemini-pro',
        messages: [],
        tools: [],
        systemPrompt: 'You are a helpful assistant',
        maxTokens: 4096,
        signal: new AbortController().signal,
      }

      const gen = provider.query(params)
      expect(gen).toBeDefined()
      expect(typeof gen[Symbol.asyncIterator]).toBe('function')
    })
  })

  describe('ProviderAdapter 接口符合性', () => {
    test('应该实现 ProviderAdapter 接口', () => {
      const adapter: GeminiProvider = provider
      expect(adapter).toBeDefined()
      expect(adapter.type).toBe('gemini')
      expect(typeof adapter.query).toBe('function')
      expect(typeof adapter.getConfig).toBe('function')
    })

    test('应该支持默认模型配置', () => {
      const p = new GeminiProvider({ defaultModel: 'gemini-ultra' })
      expect(p.getConfig().defaultModel).toBe('gemini-ultra')
    })
  })

  describe('Gemini 特定配置', () => {
    test('应该支持不同的 Gemini 模型', () => {
      const models = ['gemini-pro', 'gemini-ultra', 'gemini-flash']
      models.forEach(model => {
        const p = new GeminiProvider({ defaultModel: model })
        expect(p.getConfig().defaultModel).toBe(model)
      })
    })

    test('应该支持 API Key 配置', () => {
      const p = new GeminiProvider({ apiKey: 'AIza-test-key' })
      expect(p.getConfig().apiKey).toBe('AIza-test-key')
    })
  })
})
