/**
 * VertexProvider 测试
 *
 * 测试目标：
 * - 验证 VertexProvider 的基本功能
 * - 验证 ProviderAdapter 接口实现
 * - 验证 Vertex 特定的配置处理
 */

import { describe, test, expect, beforeEach } from 'bun:test'
import { VertexProvider } from '../VertexProvider.js'
import type { ProviderQueryParams } from '../../ProviderAdapter.js'

describe('VertexProvider', () => {
  let provider: VertexProvider

  beforeEach(() => {
    provider = new VertexProvider()
  })

  describe('基本属性', () => {
    test('type 应该是 "vertex"', () => {
      expect(provider.type).toBe('vertex')
    })

    test('getConfig 应该返回配置对象', () => {
      const config = provider.getConfig()
      expect(config).toBeDefined()
      expect(typeof config).toBe('object')
    })

    test('应该支持自定义配置', () => {
      const customProvider = new VertexProvider({
        projectId: 'test-project',
        region: 'us-central1',
      })
      const config = customProvider.getConfig()
      expect(config.projectId).toBe('test-project')
      expect(config.region).toBe('us-central1')
    })
  })

  describe('query 方法', () => {
    test('query 方法应该返回 AsyncGenerator', async () => {
      const params: ProviderQueryParams = {
        model: 'claude-3-sonnet@20240229',
        messages: [],
      }

      const gen = provider.query(params)
      expect(gen).toBeDefined()
      expect(typeof gen[Symbol.asyncIterator]).toBe('function')
    })

    test('query 方法应该支持完整的参数', async () => {
      const params: ProviderQueryParams = {
        model: 'claude-3-sonnet@20240229',
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
      const adapter: VertexProvider = provider
      expect(adapter).toBeDefined()
      expect(adapter.type).toBe('vertex')
      expect(typeof adapter.query).toBe('function')
      expect(typeof adapter.getConfig).toBe('function')
    })
  })

  describe('Vertex 特定配置', () => {
    test('应该支持 Google Cloud Project ID 配置', () => {
      const projectIds = ['my-project', 'another-project', 'test-123']
      projectIds.forEach(projectId => {
        const p = new VertexProvider({ projectId })
        expect(p.getConfig().projectId).toBe(projectId)
      })
    })

    test('应该支持 Google Cloud Region 配置', () => {
      const regions = ['us-central1', 'us-east1', 'europe-west1']
      regions.forEach(region => {
        const p = new VertexProvider({ region })
        expect(p.getConfig().region).toBe(region)
      })
    })

    test('应该同时配置 Project ID 和 Region', () => {
      const p = new VertexProvider({
        projectId: 'my-project',
        region: 'us-central1',
      })
      const config = p.getConfig()
      expect(config.projectId).toBe('my-project')
      expect(config.region).toBe('us-central1')
    })
  })
})
