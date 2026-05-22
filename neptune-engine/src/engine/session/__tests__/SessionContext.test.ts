/**
 * SessionContext 测试
 *
 * 验证 per-session 状态隔离和 AsyncLocalStorage 实现。
 */

import {describe, test, expect} from 'bun:test'
import {
	createDefaultSessionContext,
	getSessionContext,
	runInSessionContext,
	getSessionId,
	getCwd,
	isSessionPersistenceDisabled,
	updateSessionContext,
	getTokenBudgetState,
	initTokenBudgetState,
	getTurnOutputTokens,
	getCurrentTurnTokenBudget,
	snapshotOutputTokensForTurn,
	incrementBudgetContinuationCount,
	getBudgetContinuationCount,
} from '../index.js'
import type {SessionId} from '../types/ids.js'

describe('SessionContext', () => {
	describe('createDefaultSessionContext', () => {
		test('creates context with correct defaults', () => {
			const sessionId = 'test-session-1' as unknown as SessionId
			const cwd = '/test/cwd'
			const projectRoot = '/test/project'

			const ctx = createDefaultSessionContext(sessionId, cwd, projectRoot)

			expect(ctx.sessionId).toBe(sessionId)
			expect(ctx.cwd).toBe(cwd)
			expect(ctx.originalCwd).toBe(cwd)
			expect(ctx.projectRoot).toBe(projectRoot)
			expect(ctx.totalCostUSD).toBe(0)
			expect(ctx.modelUsage).toEqual({})
			expect(ctx.isInteractive).toBe(true)
			expect(ctx.sessionBypassPermissionsMode).toBe(false)
			expect(ctx.scheduledTasksEnabled).toBe(false)
			expect(ctx.sessionCronTasks).toEqual([])
			expect(ctx.sessionCreatedTeams).toBeInstanceOf(Set)
			expect(ctx.agentColorMap).toBeInstanceOf(Map)
			expect(ctx.agentColorIndex).toBe(0)
			expect(ctx.hasUnknownModelCost).toBe(false)
			expect(ctx.strictToolResultPairing).toBe(false)
			expect(ctx.userMsgOptIn).toBe(false)
			expect(ctx.kairosActive).toBe(false)
			expect(ctx.sessionPersistenceDisabled).toBe(false)
		})

		test('creates independent contexts', () => {
			const ctx1 = createDefaultSessionContext('session-1' as unknown as SessionId, '/cwd1', '/project1')
			const ctx2 = createDefaultSessionContext('session-2' as unknown as SessionId, '/cwd2', '/project2')

			expect(ctx1.sessionId).not.toBe(ctx2.sessionId)
			expect(ctx1.cwd).not.toBe(ctx2.cwd)
		})
	})

	describe('runInSessionContext', () => {
		test('sets context within callback', () => {
			const ctx = createDefaultSessionContext('test-session' as unknown as SessionId, '/test/cwd', '/test/project')

			// Outside context, should be undefined
			expect(getSessionContext()).toBeUndefined()

			runInSessionContext(ctx, () => {
				// Inside context, should be the context we set
				expect(getSessionContext()).toBe(ctx)
			})

			// After context, should be undefined again
			expect(getSessionContext()).toBeUndefined()
		})

		test('returns callback result', () => {
			const ctx = createDefaultSessionContext('test-session' as unknown as SessionId, '/test/cwd', '/test/project')

			const result = runInSessionContext(ctx, () => {
				return 'test-result'
			})

			expect(result).toBe('test-result')
		})

		test('supports nested contexts', () => {
			const ctx1 = createDefaultSessionContext('session-1' as unknown as SessionId, '/cwd1', '/project1')
			const ctx2 = createDefaultSessionContext('session-2' as unknown as SessionId, '/cwd2', '/project2')

			runInSessionContext(ctx1, () => {
				expect(getSessionId()).toBe('session-1' as unknown as SessionId)

				runInSessionContext(ctx2, () => {
					expect(getSessionId()).toBe('session-2' as unknown as SessionId)
				})

				expect(getSessionId()).toBe('session-1' as unknown as SessionId)
			})
		})
	})

	describe('getSessionId', () => {
		test('returns undefined outside context', () => {
			expect(getSessionId()).toBeUndefined()
		})

		test('returns sessionId inside context', () => {
			const ctx = createDefaultSessionContext('my-session' as unknown as SessionId, '/cwd', '/project')

			runInSessionContext(ctx, () => {
				expect(getSessionId()).toBe('my-session' as unknown as SessionId)
			})
		})
	})

	describe('getCwd', () => {
		test('returns undefined outside context', () => {
			expect(getCwd()).toBeUndefined()
		})

		test('returns cwd inside context', () => {
			const ctx = createDefaultSessionContext('session' as unknown as SessionId, '/my/cwd', '/project')

			runInSessionContext(ctx, () => {
				expect(getCwd()).toBe('/my/cwd')
			})
		})
	})

	describe('isSessionPersistenceDisabled', () => {
		test('returns false outside context', () => {
			expect(isSessionPersistenceDisabled()).toBe(false)
		})

		test('returns value from context', () => {
			const ctx = createDefaultSessionContext('session' as unknown as SessionId, '/cwd', '/project')
			ctx.sessionPersistenceDisabled = true

			runInSessionContext(ctx, () => {
				expect(isSessionPersistenceDisabled()).toBe(true)
			})
		})
	})

	describe('updateSessionContext', () => {
		test('updates context fields', () => {
			const ctx = createDefaultSessionContext('session' as unknown as SessionId, '/cwd', '/project')

			runInSessionContext(ctx, () => {
				updateSessionContext({totalCostUSD: 100, cwd: '/new/cwd'})

				expect(getSessionContext()?.totalCostUSD).toBe(100)
				expect(getSessionContext()?.cwd).toBe('/new/cwd')
			})
		})

		test('returns undefined outside context', () => {
			const result = updateSessionContext({totalCostUSD: 100})
			expect(result).toBeUndefined()
		})
	})
})

describe('TokenBudgetState', () => {
	describe('initTokenBudgetState', () => {
		test('initializes token budget state', () => {
			const sessionId = 'budget-session' as unknown as SessionId
			initTokenBudgetState(sessionId)

			const state = getTokenBudgetState()
			// Note: getTokenBudgetState requires session context to get sessionId
			// So we need to run within a context
			const ctx = createDefaultSessionContext(sessionId, '/cwd', '/project')
			runInSessionContext(ctx, () => {
				const state = getTokenBudgetState()
				expect(state).toBeDefined()
				expect(state?.outputTokensAtTurnStart).toBe(0)
				expect(state?.currentTurnTokenBudget).toBeNull()
				expect(state?.budgetContinuationCount).toBe(0)
			})
		})
	})

	describe('snapshotOutputTokensForTurn', () => {
		test('sets currentTurnTokenBudget', () => {
			const sessionId = 'budget-session-2' as unknown as SessionId
			const ctx = createDefaultSessionContext(sessionId, '/cwd', '/project')

			runInSessionContext(ctx, () => {
				snapshotOutputTokensForTurn(1000)

				expect(getCurrentTurnTokenBudget()).toBe(1000)
			})
		})
	})

	describe('incrementBudgetContinuationCount', () => {
		test('increments counter', () => {
			const sessionId = 'budget-session-3' as unknown as SessionId
			const ctx = createDefaultSessionContext(sessionId, '/cwd', '/project')

			runInSessionContext(ctx, () => {
				expect(getBudgetContinuationCount()).toBe(0)

				incrementBudgetContinuationCount()
				expect(getBudgetContinuationCount()).toBe(1)

				incrementBudgetContinuationCount()
				expect(getBudgetContinuationCount()).toBe(2)
			})
		})
	})
})

describe('Multi-session concurrency', () => {
	test('multiple sessions are isolated', async () => {
		const ctx1 = createDefaultSessionContext('concurrent-1' as unknown as SessionId, '/cwd1', '/project1')
		const ctx2 = createDefaultSessionContext('concurrent-2' as unknown as SessionId, '/cwd2', '/project2')

		const results: string[] = []

		await Promise.all([
			new Promise<void>((resolve) => {
				runInSessionContext(ctx1, () => {
					results.push(`session-1: ${getSessionId()}`)
					results.push(`cwd-1: ${getCwd()}`)
					resolve()
				})
			}),
			new Promise<void>((resolve) => {
				runInSessionContext(ctx2, () => {
					results.push(`session-2: ${getSessionId()}`)
					results.push(`cwd-2: ${getCwd()}`)
					resolve()
				})
			}),
		])

		expect(results).toContain('session-1: concurrent-1')
		expect(results).toContain('cwd-1: /cwd1')
		expect(results).toContain('session-2: concurrent-2')
		expect(results).toContain('cwd-2: /cwd2')
	})

	test('token budget states are isolated per session', async () => {
		const ctx1 = createDefaultSessionContext('budget-1' as unknown as SessionId, '/cwd1', '/project1')
		const ctx2 = createDefaultSessionContext('budget-2' as unknown as SessionId, '/cwd2', '/project2')

		await Promise.all([
			new Promise<void>((resolve) => {
				runInSessionContext(ctx1, () => {
					snapshotOutputTokensForTurn(100)
					incrementBudgetContinuationCount()
					incrementBudgetContinuationCount()
					resolve()
				})
			}),
			new Promise<void>((resolve) => {
				runInSessionContext(ctx2, () => {
					snapshotOutputTokensForTurn(200)
					incrementBudgetContinuationCount()
					resolve()
				})
			}),
		])

		// Verify isolation
		runInSessionContext(ctx1, () => {
			expect(getCurrentTurnTokenBudget()).toBe(100)
			expect(getBudgetContinuationCount()).toBe(2)
		})

		runInSessionContext(ctx2, () => {
			expect(getCurrentTurnTokenBudget()).toBe(200)
			expect(getBudgetContinuationCount()).toBe(1)
		})
	})
})
