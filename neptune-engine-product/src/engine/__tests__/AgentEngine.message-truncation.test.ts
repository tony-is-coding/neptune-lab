/**
 * AgentEngine sessionMessages 内存保护测试
 *
 * 测试消息截断功能，防止 OOM
 */

import {describe, test, expect, beforeEach, afterEach} from 'bun:test'
import {AgentEngine} from '../AgentEngine'
import type {SDKMessage} from '../types/query-events'
import {mkdirSync, rmSync, writeFileSync} from 'fs'
import {tmpdir} from 'os'
import {join} from 'path'

describe('AgentEngine - sessionMessages 内存保护', () => {
	let engine: AgentEngine
	let testWorkspace: string

	beforeEach(async () => {
		// 创建测试工作区
		testWorkspace = join(tmpdir(), `claude-test-${Date.now()}`)
		mkdirSync(testWorkspace, {recursive: true})

		// 创建默认限制的引擎
		engine = await AgentEngine.create({
			systemPrompt: 'Test prompt',
		})
	})

	afterEach(() => {
		// 清理测试工作区
		try {
			rmSync(testWorkspace, {recursive: true, force: true})
		} catch {
			// 忽略错误
		}
	})

	describe('消息截断功能', () => {
		test('应使用默认限制 10000 条消息', () => {
			// 创建超过 10000 条消息的数组
			const messages: SDKMessage[] = []
			for (let i = 0; i < 15000; i++) {
				messages.push({
					type: 'message',
					role: 'user',
					content: [{type: 'text', text: `Message ${i}`}],
				} as SDKMessage)
			}

			// 使用私有方法测试截断
			const truncatedMessages = (engine as any).truncateMessagesIfNeeded(messages, 'test-session')

			expect(truncatedMessages.length).toBe(10000)
			// 验证保留的是最新的消息
			expect(truncatedMessages[0].content[0].text).toBe('Message 5000')
			expect(truncatedMessages[9999].content[0].text).toBe('Message 14999')
		})

		test('应使用配置的自定义限制', async () => {
			// 创建自定义限制的引擎
			const customEngine = await AgentEngine.create({
				systemPrompt: 'Test prompt',
				options: {
					maxMessagesPerSession: 100,
				},
			})

			const messages: SDKMessage[] = []
			for (let i = 0; i < 200; i++) {
				messages.push({
					type: 'message',
					role: 'user',
					content: [{type: 'text', text: `Message ${i}`}],
				} as SDKMessage)
			}

			const truncatedMessages = (customEngine as any).truncateMessagesIfNeeded(messages, 'test-session')

			expect(truncatedMessages.length).toBe(100)
			expect(truncatedMessages[0].content[0].text).toBe('Message 100')
			expect(truncatedMessages[99].content[0].text).toBe('Message 199')
		})

		test('未超过限制时不应截断', () => {
			const messages: SDKMessage[] = []
			for (let i = 0; i < 5000; i++) {
				messages.push({
					type: 'message',
					role: 'user',
					content: [{type: 'text', text: `Message ${i}`}],
				} as SDKMessage)
			}

			const truncatedMessages = (engine as any).truncateMessagesIfNeeded(messages, 'test-session')

			expect(truncatedMessages.length).toBe(5000)
			expect(truncatedMessages[0].content[0].text).toBe('Message 0')
			expect(truncatedMessages[4999].content[0].text).toBe('Message 4999')
		})

		test('空消息数组不应截断', () => {
			const messages: SDKMessage[] = []

			const truncatedMessages = (engine as any).truncateMessagesIfNeeded(messages, 'test-session')

			expect(truncatedMessages.length).toBe(0)
		})

		test('正好等于限制时不应截断', () => {
			const messages: SDKMessage[] = []
			for (let i = 0; i < 10000; i++) {
				messages.push({
					type: 'message',
					role: 'user',
					content: [{type: 'text', text: `Message ${i}`}],
				} as SDKMessage)
			}

			const truncatedMessages = (engine as any).truncateMessagesIfNeeded(messages, 'test-session')

			expect(truncatedMessages.length).toBe(10000)
		})
	})

	describe('边界条件', () => {
		test('限制为 0 时不应截断消息（视为无限制）', async () => {
			const zeroLimitEngine = await AgentEngine.create({
				systemPrompt: 'Test prompt',
				options: {
					maxMessagesPerSession: 0,
				},
			})

			const messages: SDKMessage[] = [
				{
					type: 'message',
					role: 'user',
					content: [{type: 'text', text: 'Message 0'}],
				} as SDKMessage,
				{
					type: 'message',
					role: 'user',
					content: [{type: 'text', text: 'Message 1'}],
				} as SDKMessage,
			]

			const truncatedMessages = (zeroLimitEngine as any).truncateMessagesIfNeeded(messages, 'test-session')

			// 0 限制视为无限制，不应截断
			expect(truncatedMessages.length).toBe(2)
		})

		test('负数限制应视为 0（无限制）', async () => {
			const negativeLimitEngine = await AgentEngine.create({
				systemPrompt: 'Test prompt',
				options: {
					maxMessagesPerSession: -100,
				},
			})

			const messages: SDKMessage[] = []
			for (let i = 0; i < 100; i++) {
				messages.push({
					type: 'message',
					role: 'user',
					content: [{type: 'text', text: `Message ${i}`}],
				} as SDKMessage)
			}

			const truncatedMessages = (negativeLimitEngine as any).truncateMessagesIfNeeded(messages, 'test-session')

			// 负数限制被视为 0（无限制），不应截断
			expect(truncatedMessages.length).toBe(100)
		})

		test('大限制值应正常工作', async () => {
			const largeLimitEngine = await AgentEngine.create({
				systemPrompt: 'Test prompt',
				options: {
					maxMessagesPerSession: 1000000,
				},
			})

			const messages: SDKMessage[] = []
			for (let i = 0; i < 50000; i++) {
				messages.push({
					type: 'message',
					role: 'user',
					content: [{type: 'text', text: `Message ${i}`}],
				} as SDKMessage)
			}

			const truncatedMessages = (largeLimitEngine as any).truncateMessagesIfNeeded(messages, 'test-session')

			// 未超过限制，不应截断
			expect(truncatedMessages.length).toBe(50000)
		})
	})

	describe('日志警告', () => {
		test('截断时应发出警告日志', () => {
			const messages: SDKMessage[] = []
			for (let i = 0; i < 15000; i++) {
				messages.push({
					type: 'message',
					role: 'user',
					content: [{type: 'text', text: `Message ${i}`}],
				} as SDKMessage)
			}

			// 这里我们只验证方法不会抛出错误
			// 实际的日志验证需要在集成测试中进行
			expect(() => {
				(engine as any).truncateMessagesIfNeeded(messages, 'test-session')
			}).not.toThrow()
		})
	})
})
