import { describe, test, expect, beforeEach } from 'bun:test'
import { TokenBudgetManager } from '../TokenBudgetManager'
import type { SessionContext } from '../SessionContext'

describe('TokenBudgetManager', () => {
  let manager: TokenBudgetManager
  let mockSessionId: string
  let mockContext: SessionContext

  beforeEach(() => {
    manager = new TokenBudgetManager()
    mockSessionId = 'test-session-1'
    mockContext = {
      sessionId: mockSessionId,
      cwd: '/workspace',
      originalCwd: '/workspace',
      projectRoot: '/workspace',
      memoryPath: '/memory',
      isRemoteMode: false,
      isInteractive: true,
      sessionPersistenceDisabled: false,
      modelUsage: {
        'claude-3-5-sonnet-20241022': {
          inputTokens: 100,
          outputTokens: 50,
          cacheCreationInputTokens: 0,
          cacheReadInputTokens: 0,
        },
      },
    }
  })

  describe('状态初始化', () => {
    test('initTokenBudgetState - 初始化状态', () => {
      manager.initTokenBudgetState(mockSessionId)

      const state = manager.getTokenBudgetState(mockSessionId)
      expect(state).toBeDefined()
      expect(state?.outputTokensAtTurnStart).toBe(0)
      expect(state?.currentTurnTokenBudget).toBeNull()
      expect(state?.budgetContinuationCount).toBe(0)
    })

    test('initTokenBudgetState - 重复初始化覆盖旧状态', () => {
      manager.initTokenBudgetState(mockSessionId)

      const state = manager.getTokenBudgetState(mockSessionId)
      state!.budgetContinuationCount = 5

      manager.initTokenBudgetState(mockSessionId)

      const newState = manager.getTokenBudgetState(mockSessionId)
      expect(newState?.budgetContinuationCount).toBe(0)
    })

    test('getTokenBudgetState - 未初始化时返回 undefined', () => {
      const state = manager.getTokenBudgetState('nonexistent')
      expect(state).toBeUndefined()
    })
  })

  describe('Token 计算', () => {
    test('getTurnOutputTokens - 初始状态返回当前总输出 tokens', () => {
      manager.initTokenBudgetState(mockSessionId)
      const tokens = manager.getTurnOutputTokens(mockSessionId, mockContext)
      expect(tokens).toBe(50) // 等于当前总输出 tokens（因为没有快照）
    })

    test('getTurnOutputTokens - 计算当前 turn 的输出 tokens', () => {
      manager.initTokenBudgetState(mockSessionId)

      // 模拟快照
      manager.snapshotOutputTokensForTurn(mockSessionId, mockContext, 1000)

      // 模拟更多输出
      mockContext.modelUsage['claude-3-5-sonnet-20241022'].outputTokens = 150

      const tokens = manager.getTurnOutputTokens(mockSessionId, mockContext)
      expect(tokens).toBe(100) // 150 - 50
    })

    test('getTurnOutputTokens - 未初始化状态返回 0', () => {
      const tokens = manager.getTurnOutputTokens(mockSessionId, mockContext)
      expect(tokens).toBe(0)
    })

    test('getCurrentTurnTokenBudget - 获取当前预算', () => {
      manager.initTokenBudgetState(mockSessionId)
      manager.snapshotOutputTokensForTurn(mockSessionId, mockContext, 2000)

      const budget = manager.getCurrentTurnTokenBudget(mockSessionId)
      expect(budget).toBe(2000)
    })

    test('getCurrentTurnTokenBudget - 未设置时返回 null', () => {
      manager.initTokenBudgetState(mockSessionId)
      const budget = manager.getCurrentTurnTokenBudget(mockSessionId)
      expect(budget).toBeNull()
    })

    test('getCurrentTurnTokenBudget - 未初始化状态返回 null', () => {
      const budget = manager.getCurrentTurnTokenBudget(mockSessionId)
      expect(budget).toBeNull()
    })
  })

  describe('快照操作', () => {
    test('snapshotOutputTokensForTurn - 快照当前状态', () => {
      manager.initTokenBudgetState(mockSessionId)
      manager.snapshotOutputTokensForTurn(mockSessionId, mockContext, 1000)

      const state = manager.getTokenBudgetState(mockSessionId)
      expect(state?.outputTokensAtTurnStart).toBe(50) // 当前总输出 tokens
      expect(state?.currentTurnTokenBudget).toBe(1000)
    })

    test('snapshotOutputTokensForTurn - 未初始化状态无操作', () => {
      manager.snapshotOutputTokensForTurn(mockSessionId, mockContext, 1000)

      const state = manager.getTokenBudgetState(mockSessionId)
      expect(state).toBeUndefined()
    })
  })

  describe('Continuation 计数', () => {
    test('incrementBudgetContinuationCount - 增加计数', () => {
      manager.initTokenBudgetState(mockSessionId)

      expect(manager.getBudgetContinuationCount(mockSessionId)).toBe(0)

      manager.incrementBudgetContinuationCount(mockSessionId)
      expect(manager.getBudgetContinuationCount(mockSessionId)).toBe(1)

      manager.incrementBudgetContinuationCount(mockSessionId)
      expect(manager.getBudgetContinuationCount(mockSessionId)).toBe(2)
    })

    test('incrementBudgetContinuationCount - 未初始化状态无操作', () => {
      manager.incrementBudgetContinuationCount(mockSessionId)
      expect(manager.getBudgetContinuationCount(mockSessionId)).toBe(0)
    })

    test('getBudgetContinuationCount - 未初始化状态返回 0', () => {
      const count = manager.getBudgetContinuationCount('nonexistent')
      expect(count).toBe(0)
    })
  })

  describe('状态清理', () => {
    test('clearTokenBudgetState - 清理指定 session', () => {
      manager.initTokenBudgetState(mockSessionId)
      manager.snapshotOutputTokensForTurn(mockSessionId, mockContext, 1000)

      manager.clearTokenBudgetState(mockSessionId)

      const state = manager.getTokenBudgetState(mockSessionId)
      expect(state).toBeUndefined()
    })

    test('clearTokenBudgetState - 清理不存在的 session 不报错', () => {
      expect(() => manager.clearTokenBudgetState('nonexistent')).not.toThrow()
    })
  })

  describe('多 session 隔离', () => {
    test('不同 session 的状态互不影响', () => {
      const sessionId1 = 'session-1'
      const sessionId2 = 'session-2'

      manager.initTokenBudgetState(sessionId1)
      manager.initTokenBudgetState(sessionId2)

      manager.snapshotOutputTokensForTurn(sessionId1, mockContext, 1000)
      manager.snapshotOutputTokensForTurn(sessionId2, mockContext, 2000)

      expect(manager.getCurrentTurnTokenBudget(sessionId1)).toBe(1000)
      expect(manager.getCurrentTurnTokenBudget(sessionId2)).toBe(2000)

      manager.incrementBudgetContinuationCount(sessionId1)

      expect(manager.getBudgetContinuationCount(sessionId1)).toBe(1)
      expect(manager.getBudgetContinuationCount(sessionId2)).toBe(0)
    })
  })

  describe('dispose', () => {
    test('dispose - 清理所有状态', () => {
      manager.initTokenBudgetState('session-1')
      manager.initTokenBudgetState('session-2')
      manager.initTokenBudgetState('session-3')

      expect(manager.getTokenBudgetState('session-1')).toBeDefined()
      expect(manager.getTokenBudgetState('session-2')).toBeDefined()
      expect(manager.getTokenBudgetState('session-3')).toBeDefined()

      manager.dispose()

      expect(manager.getTokenBudgetState('session-1')).toBeUndefined()
      expect(manager.getTokenBudgetState('session-2')).toBeUndefined()
      expect(manager.getTokenBudgetState('session-3')).toBeUndefined()
    })
  })

  describe('复杂场景', () => {
    test('多 model 的输出 token 计算', () => {
      manager.initTokenBudgetState(mockSessionId)

      const multiModelContext: SessionContext = {
        ...mockContext,
        modelUsage: {
          'claude-3-5-sonnet-20241022': {
            inputTokens: 100,
            outputTokens: 100,
            cacheCreationInputTokens: 0,
            cacheReadInputTokens: 0,
          },
          'claude-3-5-opus-20241022': {
            inputTokens: 200,
            outputTokens: 150,
            cacheCreationInputTokens: 0,
            cacheReadInputTokens: 0,
          },
        },
      }

      manager.snapshotOutputTokensForTurn(mockSessionId, multiModelContext, 2000)

      // 增加 tokens
      multiModelContext.modelUsage['claude-3-5-sonnet-20241022'].outputTokens = 150
      multiModelContext.modelUsage['claude-3-5-opus-20241022'].outputTokens = 200

      const tokens = manager.getTurnOutputTokens(mockSessionId, multiModelContext)
      expect(tokens).toBe(100) // (150+200) - (100+150)
    })

    test('budget continuation 多次调用', () => {
      manager.initTokenBudgetState(mockSessionId)

      for (let i = 0; i < 5; i++) {
        manager.incrementBudgetContinuationCount(mockSessionId)
      }

      expect(manager.getBudgetContinuationCount(mockSessionId)).toBe(5)
    })
  })
})
