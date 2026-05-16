/**
 * AgentEngine 资源清理测试
 *
 * 测试 destroySession/destroy 后的资源清理
 */

import {describe, test, expect, beforeEach, afterEach} from 'bun:test'
import {AgentEngine} from '../AgentEngine'
import {asSessionId} from '../types/ids'
import {mkdirSync, rmSync} from 'fs'
import {tmpdir} from 'os'
import {join} from 'path'

describe('AgentEngine - 资源清理', () => {
	let engine: AgentEngine
	let testWorkspace: string

	beforeEach(async () => {
		// 创建测试工作区
		testWorkspace = join(tmpdir(), `claude-test-${Date.now()}`)
		mkdirSync(testWorkspace, {recursive: true})

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

	describe('destroySession 资源清理', () => {
		test('destroySession 应清理 sessionMessages', async () => {
			const sessionId = await engine.createSession({workspace: testWorkspace})

			// 验证 session 存在
			const session = await engine.getSession(sessionId)
			expect(session).not.toBeNull()

			// 销毁 session
			await engine.destroySession(sessionId)

			// 验证 sessionMessages 被清理
			expect(engine._getSessionMessages(sessionId)).toBeUndefined()
		})

		test('destroySession 应清理 sessionPrompts', async () => {
			const sessionId = await engine.createSession({
				workspace: testWorkspace,
				systemPrompt: 'Custom prompt',
			})

			// 验证 prompt 被存储
			const prompt = engine._getSessionPrompt(sessionId)
			expect(prompt).toBe('Custom prompt')

			// 销毁 session
			await engine.destroySession(sessionId)

			// 验证 sessionPrompts 被清理
			expect(engine._getSessionPrompt(sessionId)).toBeUndefined()
		})

		test('destroySession 应清理 queryEngines', async () => {
			const sessionId = await engine.createSession({workspace: testWorkspace})

			// 销毁 session
			await engine.destroySession(sessionId)

			// 验证 session 不存在（通过 getSession）
			const session = await engine.getSession(sessionId)
			expect(session).toBeNull()
		})
	})

	describe('destroy 资源清理', () => {
		test('destroy 应取消所有活跃查询', async () => {
			const sessionId1 = await engine.createSession({workspace: '/tmp/test-1'})
			const sessionId2 = await engine.createSession({workspace: '/tmp/test-2'})

			// 销毁引擎
			await engine.destroy()

			// 验证引擎已销毁
			await expect(engine.createSession({workspace: '/tmp/test-3'})).rejects.toThrow()
		})

		test('destroy 后调用方法应抛出错误', async () => {
			await engine.destroy()

			const sessionId = 'test-session-id'

			await expect(engine.createSession({workspace: '/tmp/test'})).rejects.toThrow()
			await expect(engine.pauseSession(sessionId)).rejects.toThrow()
			await expect(engine.resumeSession(sessionId)).rejects.toThrow()
			await expect(engine.destroySession(sessionId)).rejects.toThrow()
		})

		test('多次 destroy 应该是安全的', async () => {
			await engine.destroy()
			await engine.destroy() // 不应抛出错误
		})
	})

	describe('TokenBudget 资源清理', () => {
		test('destroySession 应清理 tokenBudgetStates', async () => {
			const sessionId = await engine.createSession({workspace: testWorkspace})

			// 销毁 session
			await engine.destroySession(sessionId)

			// 验证 TokenBudgetState 被清理
			// 由于 TokenBudgetState 是内部实现，我们通过验证不再能访问 session 来间接验证
			const session = await engine.getSession(sessionId)
			expect(session).toBeNull()
		})
	})

	describe('资源清理边界条件', () => {
		test('destroySession 不存在的 session 应抛出错误', async () => {
			await expect(
				engine.destroySession('non-existent-session')
			).rejects.toThrow()
		})

		test('destroySession 后不应能查询', async () => {
			const sessionId = await engine.createSession({workspace: testWorkspace})

			await engine.destroySession(sessionId)

			// 尝试查询应该抛出错误（session 不存在）
			const queryGen = engine.query(sessionId, 'test')
			const iterator = queryGen[Symbol.asyncIterator]()

			await expect(iterator.next()).rejects.toThrow()
		})
	})
})
