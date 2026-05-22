/**
 * AgentEngine query 互斥锁测试
 *
 * 测试场景：
 * 1. 同一 session 并发 query 第二次应抛出 SESSION_BUSY
 * 2. query 完成后锁自动释放，可以再次 query
 * 3. query 异常/abort 后锁自动释放
 */

import {describe, test, expect, beforeEach, afterEach} from 'bun:test'
import {AgentEngine} from '../AgentEngine'
import {EngineErrorCode, EngineError} from '../errors'
import type {QueryEvent} from '../types/query-events'
import type {CCRuntime, QueryEngineWrapper} from '../cc-runtime/CCRuntime'
import {MockCCRuntime, createMockCCRuntime} from '../cc-runtime/MockCCRuntime'
import {tmpdir} from 'os'
import {join} from 'path'
import {rmSync, mkdirSync} from 'fs'

// ============================================================
// 测试专用 Mock QueryEngine
// ============================================================

/** 可控的 Mock QueryEngine，用于测试互斥锁 */
class ControllableMockQueryEngine implements QueryEngineWrapper {
	private shouldBlock = false
	private shouldError = false
	private releasePromise: Promise<void> | null = null
	private resolveRelease: (() => void) | null = null

	/** 设置 query 是否阻塞（用于测试并发） */
	setBlocking(shouldBlock: boolean): void {
		this.shouldBlock = shouldBlock
		if (shouldBlock) {
			// 创建一个不会自动 resolve 的 Promise
			this.releasePromise = new Promise((resolve) => {
				this.resolveRelease = resolve
			})
		} else {
			this.releasePromise = null
			this.resolveRelease = null
		}
	}

	/** 释放阻塞的 query */
	release(): void {
		if (this.resolveRelease) {
			this.resolveRelease()
			this.resolveRelease = null
		}
		this.shouldBlock = false
		this.releasePromise = null
	}

	/** 设置 query 是否抛出错误 */
	setError(shouldError: boolean): void {
		this.shouldError = shouldError
	}

	async* submitMessage(..._args: unknown[]): AsyncGenerator<unknown, void, unknown> {
		if (this.shouldError) {
			throw new Error('Mock query error')
		}

		// 先返回一个消息
		yield {type: 'mock_message'}

		// 如果设置了阻塞，等待释放
		if (this.shouldBlock && this.releasePromise) {
			await this.releasePromise
		}

		// 再返回一个消息
		yield {type: 'mock_message_end'}
	}
}

// ============================================================
// 测试套件
// ============================================================

describe('AgentEngine.query 互斥锁', () => {
	let engine: AgentEngine
	let workspace: string
	let sessionId: string
	let mockRuntime: MockCCRuntime
	let mockQueryEngine: ControllableMockQueryEngine

	beforeEach(async () => {
		// 创建临时 workspace
		workspace = join(tmpdir(), `test-workspace-${Date.now()}`)
		mkdirSync(workspace, {recursive: true})

		// 创建可控的 Mock QueryEngine
		mockQueryEngine = new ControllableMockQueryEngine()

		// 创建 MockCCRuntime，注入我们的 Mock QueryEngine
		mockRuntime = new MockCCRuntime({
			queryEngineFactory: () => mockQueryEngine,
		})
		mockRuntime.injectMacroDefines()

		// 创建 AgentEngine
		engine = AgentEngine.create({
			systemPrompt: '你是一个测试助手',
			options: {
				maxConcurrentSessions: 10,
			},
		}, mockRuntime)

		// 创建 session
		sessionId = await engine.createSession({workspace})
	})

	afterEach(async () => {
		// 确保释放所有阻塞
		mockQueryEngine.release()

		// 清理 engine
		await engine.destroy()

		// 清理临时目录
		try {
			rmSync(workspace, {recursive: true, force: true})
		} catch {
			// 忽略清理错误
		}
	})

	test('同一 session 并发 query 第二次应抛出 SESSION_BUSY', async () => {
		// 设置第一个 query 阻塞
		mockQueryEngine.setBlocking(true)

		// 启动第一个 query（会阻塞）
		const firstQueryPromise = (async () => {
			const events: unknown[] = []
			try {
				for await (const event of engine.query(sessionId, 'first query')) {
					events.push(event)
					// 收到第一个消息后继续阻塞
				}
			} catch (error) {
				// 忽略错误
			}
			return events
		})()

		// 等待第一个 query 开始（接收到第一个消息）
		await new Promise(resolve => setTimeout(resolve, 50))

		// 第二次并发 query 应该抛出 SESSION_BUSY
		let secondQueryError: Error | null = null
		try {
			for await (const _event of engine.query(sessionId, 'second concurrent query')) {
				// 不应该到达这里
			}
		} catch (error) {
			secondQueryError = error as Error
		}

		expect(secondQueryError).not.toBeNull()
		expect(secondQueryError?.message).toContain('already has an active query')
		expect(secondQueryError).toBeInstanceOf(EngineError)
		expect((secondQueryError as EngineError).code).toBe(EngineErrorCode.SESSION_BUSY)

		// 释放第一个 query
		mockQueryEngine.release()
		await firstQueryPromise
	})

	test('query 完成后锁自动释放，可以再次 query', async () => {
		// 第一次 query（正常完成）
		const firstQueryEvents: unknown[] = []
		for await (const event of engine.query(sessionId, 'first query')) {
			firstQueryEvents.push(event)
		}

		expect(firstQueryEvents.length).toBeGreaterThan(0)

		// 第二次 query 应该成功（不抛出 SESSION_BUSY）
		const secondQueryEvents: unknown[] = []
		let secondQueryError: Error | null = null
		try {
			for await (const event of engine.query(sessionId, 'second query')) {
				secondQueryEvents.push(event)
			}
		} catch (error) {
			secondQueryError = error as Error
		}

		expect(secondQueryError).toBeNull()
		expect(secondQueryEvents.length).toBeGreaterThan(0)
	})

	test('query 异常后锁自动释放', async () => {
		// 设置 query 抛出错误
		mockQueryEngine.setError(true)

		// 第一次 query 应该抛出错误
		let firstError: Error | null = null
		try {
			for await (const _event of engine.query(sessionId, 'error query')) {
				// 不应该到达这里（在 submitMessage 时就抛出）
			}
		} catch (error) {
			firstError = error as Error
		}

		expect(firstError).not.toBeNull()

		// 重置错误状态
		mockQueryEngine.setError(false)

		// 第二次 query 应该成功（不抛出 SESSION_BUSY）
		const secondQueryEvents: unknown[] = []
		let secondQueryError: Error | null = null
		try {
			for await (const event of engine.query(sessionId, 'query after error')) {
				secondQueryEvents.push(event)
			}
		} catch (error) {
			secondQueryError = error as Error
		}

		expect(secondQueryError).toBeNull()
		expect(secondQueryEvents.length).toBeGreaterThan(0)
	})

	test('不同 session 可以并发 query', async () => {
		// 创建第二个 session
		const workspace2 = join(tmpdir(), `test-workspace-${Date.now()}-2`)
		mkdirSync(workspace2, {recursive: true})

		const sessionId2 = await engine.createSession({workspace: workspace2})

		// 设置第二个 query 阻塞
		mockQueryEngine.setBlocking(true)

		// 两个 session 并发 query
		const events1: unknown[] = []
		const events2: unknown[] = []
		let error1: Error | null = null
		let error2: Error | null = null

		const query1Promise = (async () => {
			try {
				for await (const event of engine.query(sessionId, 'query from session 1')) {
					events1.push(event)
					// 收到第一个消息后继续
				}
			} catch (error) {
				error1 = error as Error
			}
		})()

		const query2Promise = (async () => {
			try {
				for await (const event of engine.query(sessionId2, 'query from session 2')) {
					events2.push(event)
					// 收到第一个消息后继续
				}
			} catch (error) {
				error2 = error as Error
			}
		})()

		// 等待两个 query 都开始
		await new Promise(resolve => setTimeout(resolve, 50))

		// 释放阻塞
		mockQueryEngine.release()

		// 等待两个 query 完成
		await Promise.all([query1Promise, query2Promise])

		// 两个 query 都应该成功，不应该抛出 SESSION_BUSY
		expect(error1).toBeNull()
		expect(error2).toBeNull()
		expect(events1.length).toBeGreaterThan(0)
		expect(events2.length).toBeGreaterThan(0)

		// 清理
		await engine.destroySession(sessionId2)
		try {
			rmSync(workspace2, {recursive: true, force: true})
		} catch {
			// 忽略
		}
	})
})
