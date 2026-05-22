/**
 * GrokProvider 测试
 *
 * 测试目标：
 * - 验证 GrokProvider 的基本功能
 * - 验证 ProviderAdapter 接口实现
 */

import {describe, test, expect, beforeEach} from 'bun:test'
import {GrokProvider} from '../GrokProvider.js'
import type {ProviderQueryParams} from '../../ProviderAdapter.js'

describe('GrokProvider', () => {
	let provider: GrokProvider

	beforeEach(() => {
		provider = new GrokProvider()
	})

	describe('基本属性', () => {
		test('type 应该是 "grok"', () => {
			expect(provider.type).toBe('grok')
		})

		test('getConfig 应该返回配置对象', () => {
			const config = provider.getConfig()
			expect(config).toBeDefined()
			expect(typeof config).toBe('object')
		})

		test('应该支持自定义配置', () => {
			const customProvider = new GrokProvider({
				apiKey: 'test-api-key',
				baseURL: 'https://api.grok.example.com',
			})
			const config = customProvider.getConfig()
			expect(config.apiKey).toBe('test-api-key')
			expect(config.baseURL).toBe('https://api.grok.example.com')
		})
	})

	describe('query 方法', () => {
		test('query 方法应该返回 AsyncGenerator', async () => {
			const params: ProviderQueryParams = {
				model: 'grok-1',
				messages: [],
			}

			const gen = provider.query(params)
			expect(gen).toBeDefined()
			expect(typeof gen[Symbol.asyncIterator]).toBe('function')
		})

		test('query 方法应该支持完整的参数', async () => {
			const params: ProviderQueryParams = {
				model: 'grok-1',
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
			const adapter: GrokProvider = provider
			expect(adapter).toBeDefined()
			expect(adapter.type).toBe('grok')
			expect(typeof adapter.query).toBe('function')
			expect(typeof adapter.getConfig).toBe('function')
		})

		test('应该支持默认模型配置', () => {
			const p = new GrokProvider({defaultModel: 'grok-2'})
			expect(p.getConfig().defaultModel).toBe('grok-2')
		})
	})

	describe('Grok 特定配置', () => {
		test('应该支持不同的 Grok 模型', () => {
			const models = ['grok-1', 'grok-2']
			models.forEach(model => {
				const p = new GrokProvider({defaultModel: model})
				expect(p.getConfig().defaultModel).toBe(model)
			})
		})

		test('应该支持自定义 baseURL', () => {
			const baseURLs = [
				'https://api.x.ai/v1',
				'https://api.grok.example.com/v1',
			]
			baseURLs.forEach(baseURL => {
				const p = new GrokProvider({baseURL})
				expect(p.getConfig().baseURL).toBe(baseURL)
			})
		})
	})
})
