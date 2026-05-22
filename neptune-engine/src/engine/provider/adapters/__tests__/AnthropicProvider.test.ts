/**
 * AnthropicProvider 测试
 *
 * 测试目标：
 * - 验证 AnthropicProvider 的基本功能
 * - 验证 ProviderAdapter 接口实现
 * - 为未来 firstParty 适配预留测试扩展点
 *
 * 当前阶段：由于 AnthropicProvider 是 thin wrapper，实际 LLM 调用由 CC QueryEngine 完成，
 * 此测试主要验证接口符合性和错误处理。
 *
 * 未来扩展：当 T10 (Provider firstParty 适配) 完成后，需要扩展此测试以验证：
 * - 实际 API 调用
 * - 消息格式转换
 * - 流式响应处理
 * - 错误处理和重试
 */

import {describe, test, expect, beforeEach} from 'bun:test'
import {AnthropicProvider} from '../AnthropicProvider.js'
import type {ProviderQueryParams, ProviderMessage} from '../../ProviderAdapter.js'

describe('AnthropicProvider', () => {
	let provider: AnthropicProvider

	beforeEach(() => {
		provider = new AnthropicProvider()
	})

	describe('基本属性', () => {
		test('type 应该是 "anthropic"', () => {
			expect(provider.type).toBe('anthropic')
		})

		test('getConfig 应该返回空配置（当前阶段）', () => {
			const config = provider.getConfig()
			expect(config).toEqual({})
		})

		test('应该支持自定义配置', () => {
			const customProvider = new AnthropicProvider({custom: 'value'})
			const config = customProvider.getConfig()
			expect(config).toEqual({custom: 'value'})
		})
	})

	describe('query 方法（包装 queryModelWithStreaming）', () => {
		test('query 方法应该返回 AsyncGenerator', async () => {
			const params: ProviderQueryParams = {
				model: 'claude-sonnet-4-20250514',
				messages: [],
			}

			const gen = provider.query(params)
			expect(gen).toBeDefined()
			expect(typeof gen[Symbol.asyncIterator]).toBe('function')
		})

		test('query 方法应该包装 CC 的 queryModelWithStreaming', async () => {
			const params: ProviderQueryParams = {
				model: 'claude-sonnet-4-20250514',
				messages: [],
				systemPrompt: 'test',
				maxTokens: 4096,
			}

			const gen = provider.query(params)
			expect(gen).toBeDefined()

			// 注意：实际调用会尝试连接 API，在单元测试中我们不执行
			// 这里只验证方法存在并返回正确的类型
		})
	})

	describe('ProviderAdapter 接口符合性', () => {
		test('应该实现 ProviderAdapter 接口', () => {
			// TypeScript 编译时验证：AnthropicProvider 实现 ProviderAdapter
			const adapter: AnthropicProvider = provider
			expect(adapter).toBeDefined()
			expect(adapter.type).toBe('anthropic')
			expect(typeof adapter.query).toBe('function')
			expect(typeof adapter.getConfig).toBe('function')
		})

		test('query 方法应该返回 AsyncGenerator', async () => {
			const params: ProviderQueryParams = {
				model: 'claude-sonnet-4-20250514',
				messages: [],
			}

			const gen = provider.query(params)
			expect(gen).toBeDefined()
			expect(typeof gen[Symbol.asyncIterator]).toBe('function')

			// 注意：实际执行会调用 CC 的 queryModelWithStreaming，需要 mock 环境
			// 这里只验证接口符合性
		})
	})

	describe('类型安全', () => {
		test('ProviderQueryParams 类型应该接受各种参数', () => {
			const params1: ProviderQueryParams = {
				model: 'claude-sonnet-4-20250514',
				messages: [],
			}

			const params2: ProviderQueryParams = {
				model: 'claude-opus-4-20250514',
				messages: [],
				tools: [],
				systemPrompt: 'test',
				maxTokens: 4096,
				signal: new AbortController().signal,
				extra: {custom: 'value'},
			}

			expect(params1.model).toBeDefined()
			expect(params2.tools).toBeDefined()
			expect(params2.signal).toBeDefined()
		})

		test('ProviderMessage 类型应该支持标准格式', () => {
			const msg1: ProviderMessage = {
				type: 'text',
				content: 'test',
			}

			const msg2: ProviderMessage = {
				type: 'tool_use',
				content: {name: 'test', input: {}},
			}

			const msg3: ProviderMessage = {
				type: 'tool_result',
				content: {result: 'success'},
			}

			const msg4: ProviderMessage = {
				type: 'message',
				content: {role: 'assistant', content: []},
			}

			expect(msg1.type).toBe('text')
			expect(msg2.type).toBe('tool_use')
			expect(msg3.type).toBe('tool_result')
			expect(msg4.type).toBe('message')
		})
	})
})

/**
 * T10 (Provider firstParty 适配) 完成后需要扩展的测试：
 *
 * TODO: Phase 2 测试（需要 T10 完成后实现）
 *
 * describe('firstParty API 调用', () => {
 *   test('应该成功调用 Anthropic Messages API')
 *   test('应该正确处理流式响应')
 *   test('应该正确处理工具调用')
 *   test('应该正确处理错误和重试')
 * })
 *
 * describe('消息格式转换', () => {
 *   test('应该正确转换 CC Message 到 Provider 格式')
 *   test('应该正确转换 Provider 响应到 CC Message 格式')
 *   test('应该正确处理系统提示词')
 *   test('应该正确处理工具定义')
 * })
 *
 * describe('配置和选项', () => {
 *   test('应该支持 API key 配置')
 *   test('应该支持 baseURL 配置')
 *   test('应该支持 beta flags 配置')
 *   test('应该支持自定义模型')
 * })
 */
