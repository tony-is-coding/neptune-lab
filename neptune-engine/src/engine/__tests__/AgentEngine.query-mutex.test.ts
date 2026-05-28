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
import {tmpdir} from 'os'
import {join} from 'path'
import {rmSync, mkdirSync} from 'fs'
import type {ParsedSSEEvent} from '../agent-loop/types'
import type {
	StreamingProviderAdapter,
	StreamingQueryParams,
} from '../agent-loop/provider/StreamingProviderAdapter'
import {textTurn} from '../agent-loop/loop/__tests__/scriptedProvider'

// ============================================================
// 测试专用 Controllable Streaming Provider
// ============================================================

/**
 * 可控的 Mock StreamingProvider，用于测试互斥锁。
 *
 * - setBlocking(true) → queryStream 在 yield 第一个事件后等待 release()
 * - setError(true)    → queryStream 直接抛出错误
 * - release()         → 释放阻塞，让流继续
 */
class ControllableStreamingProvider implements StreamingProviderAdapter {
	readonly type = 'controllable' as const
	private shouldBlock = false
	private shouldError = false
	private releasePromise: Promise<void> | null = null
	private resolveRelease: (() => void) | null = null

	setBlocking(shouldBlock: boolean): void {
		this.shouldBlock = shouldBlock
		if (shouldBlock) {
			this.releasePromise = new Promise((resolve) => {
				this.resolveRelease = resolve
			})
		} else {
			this.releasePromise = null
			this.resolveRelease = null
		}
	}

	release(): void {
		if (this.resolveRelease) {
			this.resolveRelease()
			this.resolveRelease = null
		}
		this.shouldBlock = false
		this.releasePromise = null
	}

	setError(shouldError: boolean): void {
		this.shouldError = shouldError
	}

	async *queryStream(
		_params: StreamingQueryParams,
	): AsyncGenerator<ParsedSSEEvent, void, unknown> {
		if (this.shouldError) {
			throw new Error('Mock query error')
		}

		// 先 yield 一些起始事件，让外层 query() 真正开始消费 generator
		const events = textTurn('mock')

		// 拆 events 成两半，中间插入 release 等待，模拟 long-running query
		yield events[0]! // message_start
		yield events[1]! // content_block_complete

		if (this.shouldBlock && this.releasePromise) {
			await this.releasePromise
		}

		yield events[2]! // message_delta
		yield events[3]! // message_stop
	}
}

// ============================================================
// 测试套件
// ============================================================

describe('AgentEngine.query 互斥锁', () => {
	let engine: AgentEngine
	let workspace: string
	let sessionId: string
	let provider: ControllableStreamingProvider

	beforeEach(async () => {
		workspace = join(tmpdir(), `test-workspace-${Date.now()}`)
		mkdirSync(workspace, {recursive: true})

		provider = new ControllableStreamingProvider()

		engine = AgentEngine.create({
			systemPrompt: '你是一个测试助手',
			streamingProvider: provider,
			options: {
				maxConcurrentSessions: 10,
			},
		})

		sessionId = await engine.createSession({workspace})
	})

	afterEach(async () => {
		// 确保释放所有阻塞
		provider.release()

		await engine.destroy()

		try {
			rmSync(workspace, {recursive: true, force: true})
		} catch {
			// 忽略清理错误
		}
	})

	test('同一 session 并发 query 第二次应抛出 SESSION_BUSY', async () => {
		// 设置第一个 query 阻塞
		provider.setBlocking(true)

		// 启动第一个 query（会阻塞）
		const firstQueryPromise = (async () => {
			const events: unknown[] = []
			try {
				for await (const event of engine.query(sessionId, 'first query')) {
					events.push(event)
				}
			} catch {
				// 忽略错误
			}
			return events
		})()

		// 等待第一个 query 开始
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
		provider.release()
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
		provider.setError(true)

		// 第一次 query：substrate 路径会把 error 转成 error event 而非 throw
		// 我们关心的是「锁释放」语义，所以同时接受 throw 或 error event 任一即可
		let firstError: Error | null = null
		const firstEvents: unknown[] = []
		try {
			for await (const event of engine.query(sessionId, 'error query')) {
				firstEvents.push(event)
			}
		} catch (error) {
			firstError = error as Error
		}

		const sawErrorEvent = firstEvents.some(
			e => (e as {type: string}).type === 'error' || (e as {type: string}).type === 'assistant_error',
		)
		expect(firstError !== null || sawErrorEvent).toBe(true)

		// 重置错误状态
		provider.setError(false)

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

		// 设置 provider 阻塞
		provider.setBlocking(true)

		// 两个 session 并发 query
		const events1: unknown[] = []
		const events2: unknown[] = []
		let error1: Error | null = null
		let error2: Error | null = null

		const query1Promise = (async () => {
			try {
				for await (const event of engine.query(sessionId, 'query from session 1')) {
					events1.push(event)
				}
			} catch (error) {
				error1 = error as Error
			}
		})()

		const query2Promise = (async () => {
			try {
				for await (const event of engine.query(sessionId2, 'query from session 2')) {
					events2.push(event)
				}
			} catch (error) {
				error2 = error as Error
			}
		})()

		// 等待两个 query 都开始
		await new Promise(resolve => setTimeout(resolve, 50))

		// 释放阻塞
		provider.release()

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
