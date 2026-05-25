/**
 * OpenAIProvider 测试
 *
 * 测试目标：
 * - 验证 OpenAIProvider 的基本功能
 * - 验证 ProviderAdapter 接口实现
 */

import {describe, test, expect, beforeEach} from 'bun:test'
import {OpenAIProvider} from '../OpenAIProvider.js'
import type {ProviderQueryParams} from '@neptune/engine/provider/ProviderAdapter.js'

describe('OpenAIProvider', () => {
	let provider: OpenAIProvider

	beforeEach(() => {
		provider = new OpenAIProvider()
	})

	describe('基本属性', () => {
		test('type 应该是 "openai"', () => {
			expect(provider.type).toBe('openai')
		})

		test('getConfig 应该返回配置对象', () => {
			const config = provider.getConfig()
			expect(config).toBeDefined()
			expect(typeof config).toBe('object')
		})

		test('应该支持自定义配置', () => {
			const customProvider = new OpenAIProvider({
				apiKey: 'test-api-key',
				baseURL: 'https://api.openai.example.com',
			})
			const config = customProvider.getConfig()
			expect(config.apiKey).toBe('test-api-key')
			expect(config.baseURL).toBe('https://api.openai.example.com')
		})
	})

	describe('query 方法', () => {
		test('query 方法应该返回 AsyncGenerator', async () => {
			const params: ProviderQueryParams = {
				model: 'gpt-4',
				messages: [],
			}

			const gen = provider.query(params)
			expect(gen).toBeDefined()
			expect(typeof gen[Symbol.asyncIterator]).toBe('function')
		})

		test('query 方法应该支持完整的参数', async () => {
			const params: ProviderQueryParams = {
				model: 'gpt-4-turbo',
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
			const adapter: OpenAIProvider = provider
			expect(adapter).toBeDefined()
			expect(adapter.type).toBe('openai')
			expect(typeof adapter.query).toBe('function')
			expect(typeof adapter.getConfig).toBe('function')
		})

		test('应该支持默认模型配置', () => {
			const p = new OpenAIProvider({defaultModel: 'gpt-3.5-turbo'})
			expect(p.getConfig().defaultModel).toBe('gpt-3.5-turbo')
		})
	})

	describe('OpenAI 特定配置', () => {
		test('应该支持不同的 OpenAI 模型', () => {
			const models = ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo']
			models.forEach(model => {
				const p = new OpenAIProvider({defaultModel: model})
				expect(p.getConfig().defaultModel).toBe(model)
			})
		})

		test('应该支持自定义 baseURL', () => {
			const baseURLs = [
				'https://api.openai.com/v1',
				'https://api.openai.example.com/v1',
			]
			baseURLs.forEach(baseURL => {
				const p = new OpenAIProvider({baseURL})
				expect(p.getConfig().baseURL).toBe(baseURL)
			})
		})
	})
})
