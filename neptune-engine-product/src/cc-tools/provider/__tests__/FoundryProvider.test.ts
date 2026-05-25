/**
 * FoundryProvider 测试
 *
 * 测试目标：
 * - 验证 FoundryProvider 的基本功能
 * - 验证 ProviderAdapter 接口实现
 */

import {describe, test, expect, beforeEach} from 'bun:test'
import {FoundryProvider} from '../FoundryProvider.js'
import type {ProviderQueryParams} from '@neptune/engine/provider/ProviderAdapter.js'

describe('FoundryProvider', () => {
	let provider: FoundryProvider

	beforeEach(() => {
		provider = new FoundryProvider()
	})

	describe('基本属性', () => {
		test('type 应该是 "foundry"', () => {
			expect(provider.type).toBe('foundry')
		})

		test('getConfig 应该返回配置对象', () => {
			const config = provider.getConfig()
			expect(config).toBeDefined()
			expect(typeof config).toBe('object')
		})

		test('应该支持自定义配置', () => {
			const customProvider = new FoundryProvider({
				apiKey: 'test-api-key',
				baseURL: 'https://api.foundry.example.com',
			})
			const config = customProvider.getConfig()
			expect(config.apiKey).toBe('test-api-key')
			expect(config.baseURL).toBe('https://api.foundry.example.com')
		})
	})

	describe('query 方法', () => {
		test('query 方法应该返回 AsyncGenerator', async () => {
			const params: ProviderQueryParams = {
				model: 'claude-3-sonnet-20240229',
				messages: [],
			}

			const gen = provider.query(params)
			expect(gen).toBeDefined()
			expect(typeof gen[Symbol.asyncIterator]).toBe('function')
		})

		test('query 方法应该支持完整的参数', async () => {
			const params: ProviderQueryParams = {
				model: 'claude-3-sonnet-20240229',
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
			const adapter: FoundryProvider = provider
			expect(adapter).toBeDefined()
			expect(adapter.type).toBe('foundry')
			expect(typeof adapter.query).toBe('function')
			expect(typeof adapter.getConfig).toBe('function')
		})

		test('应该支持默认模型配置', () => {
			const p = new FoundryProvider({defaultModel: 'claude-3-opus-20240229'})
			expect(p.getConfig().defaultModel).toBe('claude-3-opus-20240229')
		})
	})
})
