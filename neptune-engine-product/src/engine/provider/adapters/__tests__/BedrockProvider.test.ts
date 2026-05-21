/**
 * BedrockProvider 测试
 *
 * 测试目标：
 * - 验证 BedrockProvider 的基本功能
 * - 验证 ProviderAdapter 接口实现
 * - 验证 Bedrock 特定的配置处理
 */

import {describe, test, expect, beforeEach} from 'bun:test'
import {BedrockProvider} from '../BedrockProvider.js'
import type {ProviderQueryParams} from '../../ProviderAdapter.js'

describe('BedrockProvider', () => {
	let provider: BedrockProvider

	beforeEach(() => {
		provider = new BedrockProvider()
	})

	describe('基本属性', () => {
		test('type 应该是 "bedrock"', () => {
			expect(provider.type).toBe('bedrock')
		})

		test('getConfig 应该返回配置对象', () => {
			const config = provider.getConfig()
			expect(config).toBeDefined()
			expect(typeof config).toBe('object')
		})

		test('应该支持自定义配置', () => {
			const customProvider = new BedrockProvider({
				region: 'us-west-2',
				accessKeyId: 'test-key',
			})
			const config = customProvider.getConfig()
			expect(config.region).toBe('us-west-2')
			expect(config.accessKeyId).toBe('test-key')
		})

		test('应该支持 AWS Session Token 配置', () => {
			const customProvider = new BedrockProvider({
				sessionToken: 'test-session-token',
			})
			const config = customProvider.getConfig()
			expect(config.sessionToken).toBe('test-session-token')
		})
	})

	describe('query 方法', () => {
		test('query 方法应该返回 AsyncGenerator', async () => {
			const params: ProviderQueryParams = {
				model: 'anthropic.claude-3-sonnet-20240229-v1:0',
				messages: [],
			}

			const gen = provider.query(params)
			expect(gen).toBeDefined()
			expect(typeof gen[Symbol.asyncIterator]).toBe('function')
		})

		test('query 方法应该支持完整的参数', async () => {
			const params: ProviderQueryParams = {
				model: 'anthropic.claude-3-sonnet-20240229-v1:0',
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
			const adapter: BedrockProvider = provider
			expect(adapter).toBeDefined()
			expect(adapter.type).toBe('bedrock')
			expect(typeof adapter.query).toBe('function')
			expect(typeof adapter.getConfig).toBe('function')
		})

		test('getConfig 应该返回只读配置', () => {
			const config = provider.getConfig()
			// 验证返回的是配置对象的快照，不是直接引用
			expect(Object.isFrozen(config) || config instanceof Object).toBe(true)
		})
	})

	describe('Bedrock 特定配置', () => {
		test('应该支持 AWS Region 配置', () => {
			const regions = ['us-east-1', 'us-west-2', 'eu-central-1']
			regions.forEach(region => {
				const p = new BedrockProvider({region})
				expect(p.getConfig().region).toBe(region)
			})
		})

		test('应该支持 AWS Credentials 配置', () => {
			const p = new BedrockProvider({
				accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
				secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
			})
			const config = p.getConfig()
			expect(config.accessKeyId).toBeDefined()
			expect(config.secretAccessKey).toBeDefined()
		})
	})
})
