/**
 * SessionContextStorage 资源清理测试
 *
 * 测试 AsyncGenerator 在提前退出/中断场景下的资源清理
 */

import {describe, test, expect, beforeEach} from 'bun:test'
import {
	runInSessionContextAsync,
	getSessionId,
} from '../SessionContextStorage'
import type {SessionContext} from '../SessionContext'

describe('SessionContextStorage - 资源清理', () => {
	let mockContext: SessionContext
	let cleanupCalled: boolean

	beforeEach(() => {
		mockContext = {
			sessionId: 'test-session-123',
			cwd: '/workspace',
			originalCwd: '/workspace',
			projectRoot: '/workspace',
			memoryPath: '/memory',
			isRemoteMode: false,
			isInteractive: true,
			sessionPersistenceDisabled: false,
			modelUsage: {},
		}
		cleanupCalled = false
	})

	describe('AsyncGenerator 提前退出场景', () => {
		test('break 提前退出应触发 generator cleanup', async () => {
			const generator = (async function* () {
				try {
					yield getSessionId()
					yield getSessionId()
					yield getSessionId()
				} finally {
					cleanupCalled = true
				}
			})()

			const asyncGen = runInSessionContextAsync(mockContext, () => generator)

			let count = 0
			for await (const value of asyncGen) {
				count++
				expect(value).toBe('test-session-123')
				// 提前退出
				if (count >= 2) break
			}

			// 验证 finally 块被执行
			expect(cleanupCalled).toBe(true)
		})

		test('return() 方法应触发 generator cleanup', async () => {
			const generator = (async function* () {
				try {
					yield getSessionId()
					yield getSessionId()
				} finally {
					cleanupCalled = true
				}
			})()

			const asyncGen = runInSessionContextAsync(mockContext, () => generator)
			const iterator = asyncGen[Symbol.asyncIterator]()

			// 消费第一个值
			await iterator.next()
			expect(cleanupCalled).toBe(false)

			// 显式调用 return() 提前退出
			await iterator.return?.()

			// 验证 finally 块被执行
			expect(cleanupCalled).toBe(true)
		})

		test('throw() 方法应触发 generator cleanup', async () => {
			const generator = (async function* () {
				try {
					yield getSessionId()
					yield getSessionId()
				} finally {
					cleanupCalled = true
				}
			})()

			const asyncGen = runInSessionContextAsync(mockContext, () => generator)
			const iterator = asyncGen[Symbol.asyncIterator]()

			// 消费第一个值
			await iterator.next()
			expect(cleanupCalled).toBe(false)

			// 显式调用 throw()
			try {
				await iterator.throw(new Error('Test error'))
			} catch {
				// 预期会抛出错误
			}

			// 验证 finally 块被执行
			expect(cleanupCalled).toBe(true)
		})

		test('嵌套 generator 提前退出应触发所有 cleanup', async () => {
			let outerCleanup = false
			let innerCleanup = false

			const innerGenerator = (async function* () {
				try {
					yield getSessionId()
					yield getSessionId()
				} finally {
					innerCleanup = true
				}
			})()

			const outerGenerator = (async function* () {
				try {
					yield getSessionId()
					const innerGen = runInSessionContextAsync(mockContext, () => innerGenerator)
					for await (const value of innerGen) {
						yield value
					}
					yield getSessionId()
				} finally {
					outerCleanup = true
				}
			})()

			const asyncGen = runInSessionContextAsync(mockContext, () => outerGenerator)

			let count = 0
			for await (const value of asyncGen) {
				count++
				// 提前退出
				if (count >= 3) break
			}

			// 等待 cleanup 执行
			await new Promise(resolve => setTimeout(resolve, 10))

			// 验证所有 finally 块被执行
			expect(innerCleanup).toBe(true)
			expect(outerCleanup).toBe(true)
		})

		test('超时场景下的 generator cleanup', async () => {
			const generator = (async function* () {
				try {
					yield getSessionId()
					// 模拟长时间操作
					await new Promise(resolve => setTimeout(resolve, 1000))
					yield getSessionId()
				} finally {
					cleanupCalled = true
				}
			})()

			const asyncGen = runInSessionContextAsync(mockContext, () => generator)
			const iterator = asyncGen[Symbol.asyncIterator]()

			// 消费第一个值
			await iterator.next()

			// 模拟超时：直接调用 return() 中断 generator
			await iterator.return?.()

			// 验证 finally 块被执行
			expect(cleanupCalled).toBe(true)
		})
	})

	describe('AsyncGenerator 错误传播', () => {
		test('generator 内部错误应正确传播', async () => {
			const generator = (async function* () {
				try {
					yield getSessionId()
					throw new Error('Generator error')
				} finally {
					cleanupCalled = true
				}
			})()

			const asyncGen = runInSessionContextAsync(mockContext, () => generator)

			await expect(async () => {
				for await (const value of asyncGen) {
					// 消费数据
				}
			}).toThrow('Generator error')

			expect(cleanupCalled).toBe(true)
		})

		test('generator 外部中断应触发 cleanup', async () => {
			const generator = (async function* () {
				try {
					yield getSessionId()
					await new Promise(() => {
						// 永不 resolve 的 promise
					})
					yield getSessionId()
				} finally {
					cleanupCalled = true
				}
			})()

			const asyncGen = runInSessionContextAsync(mockContext, () => generator)

			const iterator = asyncGen[Symbol.asyncIterator]()

			// 消费第一个值
			await iterator.next()

			// 中断 generator
			await iterator.return?.()

			// 验证 finally 块被执行
			expect(cleanupCalled).toBe(true)
		})
	})
})
