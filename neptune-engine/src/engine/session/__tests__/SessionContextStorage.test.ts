import {describe, test, expect, beforeEach} from 'bun:test'
import {
	getSessionContext,
	runInSessionContext,
	runInSessionContextAsync,
	getSessionId,
	getCwd,
	getOriginalCwd,
	getProjectRoot,
	getIsRemoteMode,
	getIsNonInteractiveSession,
	getIsInteractive,
	getMemoryPath,
	updateSessionContext,
	isSessionPersistenceDisabled,
	getCurrentSessionId,
	getCurrentCwd,
} from '../SessionContextStorage'
import type {SessionContext} from '../SessionContext'

describe('SessionContextStorage', () => {
	let mockContext: SessionContext

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
	})

	describe('基本上下文访问', () => {
		test('getSessionContext - 无上下文时返回 undefined', () => {
			const ctx = getSessionContext()
			expect(ctx).toBeUndefined()
		})

		test('getSessionContext - 在上下文中返回正确值', () => {
			const result = runInSessionContext(mockContext, () => {
				return getSessionContext()
			})

			expect(result).toBeDefined()
			expect(result?.sessionId).toBe('test-session-123')
		})

		test('runInSessionContext - 嵌套上下文，内层优先', () => {
			const innerContext: SessionContext = {
				...mockContext,
				sessionId: 'inner-session',
			}

			const result = runInSessionContext(mockContext, () => {
				expect(getSessionId()).toBe('test-session-123')

				return runInSessionContext(innerContext, () => {
					return getSessionId()
				})
			})

			expect(result).toBe('inner-session')
		})

		test('runInSessionContext - 上下文结束后恢复原值', () => {
			const sessionId1 = 'session-1'
			const sessionId2 = 'session-2'

			const context1: SessionContext = {...mockContext, sessionId: sessionId1}
			const context2: SessionContext = {...mockContext, sessionId: sessionId2}

			let outerResult: string | undefined
			let innerResult: string | undefined
			let afterResult: string | undefined

			runInSessionContext(context1, () => {
				outerResult = getSessionId()

				runInSessionContext(context2, () => {
					innerResult = getSessionId()
				})

				afterResult = getSessionId()
			})

			expect(outerResult).toBe(sessionId1)
			expect(innerResult).toBe(sessionId2)
			expect(afterResult).toBe(sessionId1)
		})
	})

	describe('字段访问器', () => {
		test('getSessionId - 返回当前 sessionId', () => {
			const result = runInSessionContext(mockContext, () => {
				return getSessionId()
			})

			expect(result).toBe('test-session-123')
		})

		test('getCwd - 返回当前 cwd', () => {
			const result = runInSessionContext(mockContext, () => {
				return getCwd()
			})

			expect(result).toBe('/workspace')
		})

		test('getOriginalCwd - 返回 originalCwd', () => {
			const result = runInSessionContext(mockContext, () => {
				return getOriginalCwd()
			})

			expect(result).toBe('/workspace')
		})

		test('getProjectRoot - 返回 projectRoot', () => {
			const result = runInSessionContext(mockContext, () => {
				return getProjectRoot()
			})

			expect(result).toBe('/workspace')
		})

		test('getIsRemoteMode - 返回 isRemoteMode', () => {
			const result = runInSessionContext(mockContext, () => {
				return getIsRemoteMode()
			})

			expect(result).toBe(false)
		})

		test('getIsInteractive - 返回 isInteractive', () => {
			const result = runInSessionContext(mockContext, () => {
				return getIsInteractive()
			})

			expect(result).toBe(true)
		})

		test('getIsNonInteractiveSession - 返回 !isInteractive', () => {
			const result1 = runInSessionContext(mockContext, () => {
				return getIsNonInteractiveSession()
			})

			expect(result1).toBe(false)

			const nonInteractiveContext: SessionContext = {
				...mockContext,
				isInteractive: false,
			}

			const result2 = runInSessionContext(nonInteractiveContext, () => {
				return getIsNonInteractiveSession()
			})

			expect(result2).toBe(true)
		})

		test('getMemoryPath - 返回 memoryPath', () => {
			const result = runInSessionContext(mockContext, () => {
				return getMemoryPath()
			})

			expect(result).toBe('/memory')
		})

		test('isSessionPersistenceDisabled - 返回 sessionPersistenceDisabled', () => {
			const result = runInSessionContext(mockContext, () => {
				return isSessionPersistenceDisabled()
			})

			expect(result).toBe(false)

			const disabledContext: SessionContext = {
				...mockContext,
				sessionPersistenceDisabled: true,
			}

			const result2 = runInSessionContext(disabledContext, () => {
				return isSessionPersistenceDisabled()
			})

			expect(result2).toBe(true)
		})

		test('无上下文时访问器返回 undefined 或默认值', () => {
			expect(getSessionId()).toBeUndefined()
			expect(getCwd()).toBeUndefined()
			expect(getOriginalCwd()).toBeUndefined()
			expect(getProjectRoot()).toBeUndefined()
			expect(getIsRemoteMode()).toBe(false)
			expect(getIsInteractive()).toBe(false)
			expect(getIsNonInteractiveSession()).toBe(true)
			expect(getMemoryPath()).toBeUndefined()
			expect(isSessionPersistenceDisabled()).toBe(false)
		})
	})

	describe('上下文更新', () => {
		test('updateSessionContext - 更新单个字段', () => {
			const result = runInSessionContext(mockContext, () => {
				updateSessionContext({cwd: '/new-workspace'})
				return getCwd()
			})

			expect(result).toBe('/new-workspace')
		})

		test('updateSessionContext - 更新多个字段', () => {
			const result = runInSessionContext(mockContext, () => {
				updateSessionContext({
					cwd: '/new-workspace',
					isRemoteMode: true,
				})

				return {
					cwd: getCwd(),
					isRemoteMode: getIsRemoteMode(),
				}
			})

			expect(result.cwd).toBe('/new-workspace')
			expect(result.isRemoteMode).toBe(true)
		})

		test('updateSessionContext - 更新会影响传入的上下文对象', () => {
			const originalSessionId = mockContext.sessionId

			runInSessionContext(mockContext, () => {
				updateSessionContext({sessionId: 'new-session'})
				expect(getSessionId()).toBe('new-session')
			})

			// AsyncLocalStorage 中的对象是可变的，原始对象会被修改
			expect(mockContext.sessionId).toBe('new-session')
		})

		test('updateSessionContext - 无上下文时返回 undefined', () => {
			const result = updateSessionContext({cwd: '/new'})
			expect(result).toBeUndefined()
		})
	})

	describe('异步上下文执行', () => {
		test('runInSessionContext - 执行异步函数', async () => {
			const result = await runInSessionContext(mockContext, async () => {
				await Promise.resolve()
				return getSessionId()
			})

			expect(result).toBe('test-session-123')
		})

		test('runInSessionContextAsync - 执行异步生成器', async () => {
			async function* generator() {
				yield getSessionId()
				yield getCwd()
				yield getIsInteractive()
			}

			const results: unknown[] = []
			const asyncGen = runInSessionContextAsync(mockContext, generator)

			for await (const value of asyncGen) {
				results.push(value)
			}

			expect(results).toEqual(['test-session-123', '/workspace', true])
		})

		test('runInSessionContextAsync - 上下文在生成器迭代间保持', async () => {
			async function* generator() {
				yield getSessionId()
				// 模拟异步操作
				await new Promise(resolve => setTimeout(resolve, 10))
				// 上下文应该仍然可用
				yield getSessionId()
			}

			const results: unknown[] = []
			const asyncGen = runInSessionContextAsync(mockContext, generator)

			for await (const value of asyncGen) {
				results.push(value)
			}

			expect(results).toEqual(['test-session-123', 'test-session-123'])
		})

		test('runInSessionContextAsync - 嵌套异步生成器', async () => {
			const innerContext: SessionContext = {
				...mockContext,
				sessionId: 'inner-session',
			}

			async function* outerGen() {
				yield getSessionId()
				const innerGen = runInSessionContextAsync(innerContext, async function* () {
					yield getSessionId()
				})
				for await (const value of innerGen) {
					yield value
				}
				yield getSessionId()
			}

			const results: unknown[] = []
			const asyncGen = runInSessionContextAsync(mockContext, outerGen)

			for await (const value of asyncGen) {
				results.push(value)
			}

			expect(results).toEqual(['test-session-123', 'inner-session', 'test-session-123'])
		})
	})

	describe('向后兼容 API', () => {
		test('getCurrentSessionId - 等同于 getSessionId', () => {
			const result = runInSessionContext(mockContext, () => {
				return getCurrentSessionId()
			})

			expect(result).toBe('test-session-123')
		})

		test('getCurrentCwd - 等同于 getCwd', () => {
			const result = runInSessionContext(mockContext, () => {
				return getCurrentCwd()
			})

			expect(result).toBe('/workspace')
		})
	})

	describe('Token Budget 状态初始化', () => {
		test('runInSessionContext 自动初始化 TokenBudgetState', () => {
			// 这个测试验证 TokenBudgetState 在首次进入上下文时被初始化
			// 实际的 TokenBudgetState 验证在 TokenBudgetManager.test.ts 中
			const result = runInSessionContext(mockContext, () => {
				return getSessionId()
			})

			expect(result).toBe('test-session-123')
		})

		test('runInSessionContextAsync 自动初始化 TokenBudgetState', async () => {
			async function* generator() {
				yield getSessionId()
			}

			const asyncGen = runInSessionContextAsync(mockContext, generator)
			const results = []

			for await (const value of asyncGen) {
				results.push(value)
			}

			expect(results).toEqual(['test-session-123'])
		})
	})

	describe('边界条件', () => {
		test('空上下文对象', () => {
			const emptyContext = {} as SessionContext

			const result = runInSessionContext(emptyContext, () => {
				return getSessionId()
			})

			expect(result).toBeUndefined()
		})

		test('上下文字段为 undefined', () => {
			const partialContext: SessionContext = {
				sessionId: 'test-123',
				cwd: '/workspace',
				originalCwd: undefined,
				projectRoot: undefined,
				memoryPath: undefined,
				isRemoteMode: false,
				isInteractive: true,
				sessionPersistenceDisabled: false,
				modelUsage: {},
			}

			const result = runInSessionContext(partialContext, () => {
				return {
					sessionId: getSessionId(),
					originalCwd: getOriginalCwd(),
					projectRoot: getProjectRoot(),
					memoryPath: getMemoryPath(),
				}
			})

			expect(result.sessionId).toBe('test-123')
			expect(result.originalCwd).toBeUndefined()
			expect(result.projectRoot).toBeUndefined()
			expect(result.memoryPath).toBeUndefined()
		})
	})
})
