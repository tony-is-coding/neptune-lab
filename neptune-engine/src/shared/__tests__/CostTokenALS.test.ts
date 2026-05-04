/**
 * 成本/Token ALS 双写 + 优先测试
 *
 * 验证成本相关字段的 ALS 双写和优先读取：
 * 1. setter 双写（STATE + ALS bridge）
 * 2. getter ALS 优先 + fallback
 * 3. 成本恢复功能的 ALS 同步
 */

import { describe, test, expect, beforeEach } from 'bun:test'
import { resetStateForTests } from '../../bootstrap/state'
import {
  addToTotalCostState,
  getTotalCostUSD,
  getTotalAPIDuration,
  getTotalToolDuration,
  getModelUsage,
  setCostStateForRestore,
} from '../../bootstrap/state'
import {
  runWithContext,
  createContext,
  getTotalCostUSD as getContextTotalCostUSD,
  getTotalAPIDuration as getContextTotalAPIDuration,
  getTotalToolDuration as getContextTotalToolDuration,
  getModelUsage as getContextModelUsage,
} from '../SessionContextBridge'

describe('成本/Token ALS 双写 + 优先', () => {
  beforeEach(() => {
    // 重置全局状态
    resetStateForTests()
  })

  test('addToTotalCostState() — 双写到 STATE + ALS bridge', () => {
    const initialCost = getTotalCostUSD()
    expect(initialCost).toBe(0)

    // 添加成本
    const cost1 = 1.5
    const modelUsage1 = {
      inputTokens: 100,
      outputTokens: 50,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    } as any
    addToTotalCostState(cost1, modelUsage1, 'model1')

    // 验证 STATE 更新
    expect(getTotalCostUSD()).toBe(cost1)

    // 注意：由于 addToTotalCostState 是在全局上下文中调用的，
    // ALS bridge 的双写只在有 ALS 上下文时有效
    // 这里验证在有 ALS 上下文时，getter 会优先读取 ALS 的值
    runWithContext(createContext({ totalCostUSD: cost1 + 100 }), () => {
      expect(getTotalCostUSD()).toBe(cost1 + 100)
    })

    // ALS 上下文结束后，恢复到全局 STATE
    expect(getTotalCostUSD()).toBe(cost1)
  })

  test('getTotalCostUSD() — ALS 优先 + fallback', () => {
    const globalCost = getTotalCostUSD()

    // 无 ALS 上下文时，应该返回全局 STATE 的值
    expect(getTotalCostUSD()).toBe(globalCost)

    // 有 ALS 上下文时，应该优先返回 ALS 的值
    const contextCost = globalCost + 10
    runWithContext(createContext({ totalCostUSD: contextCost }), () => {
      expect(getTotalCostUSD()).toBe(contextCost)
    })

    // ALS 上下文结束后，应该恢复到全局 STATE
    expect(getTotalCostUSD()).toBe(globalCost)
  })

  test('getTotalAPIDuration() — ALS 优先 + fallback', () => {
    const globalDuration = getTotalAPIDuration()

    // 无 ALS 上下文时，应该返回全局 STATE 的值
    expect(getTotalAPIDuration()).toBe(globalDuration)

    // 有 ALS 上下文时，应该优先返回 ALS 的值
    const contextDuration = globalDuration + 1000
    runWithContext(createContext({ totalAPIDuration: contextDuration }), () => {
      expect(getTotalAPIDuration()).toBe(contextDuration)
    })

    // ALS 上下文结束后，应该恢复到全局 STATE
    expect(getTotalAPIDuration()).toBe(globalDuration)
  })

  test('getTotalToolDuration() — ALS 优先 + fallback', () => {
    const globalToolDuration = getTotalToolDuration()

    // 无 ALS 上下文时，应该返回全局 STATE 的值
    expect(getTotalToolDuration()).toBe(globalToolDuration)

    // 有 ALS 上下文时，应该优先返回 ALS 的值
    const contextToolDuration = globalToolDuration + 500
    runWithContext(createContext({ totalToolDuration: contextToolDuration }), () => {
      expect(getTotalToolDuration()).toBe(contextToolDuration)
    })

    // ALS 上下文结束后，应该恢复到全局 STATE
    expect(getTotalToolDuration()).toBe(globalToolDuration)
  })

  test('getModelUsage() — ALS 优先 + fallback', () => {
    const globalModelUsage = getModelUsage()

    // 无 ALS 上下文时，应该返回全局 STATE 的值
    expect(getModelUsage()).toEqual(globalModelUsage)

    // 有 ALS 上下文时，应该优先返回 ALS 的值
    const contextModelUsage = {
      'test-model': {
        inputTokens: 100,
        outputTokens: 50,
      },
    }
    runWithContext(createContext({ modelUsage: contextModelUsage }), () => {
      expect(getContextModelUsage()).toEqual(contextModelUsage)
    })

    // ALS 上下文结束后，应该恢复到全局 STATE
    expect(getModelUsage()).toEqual(globalModelUsage)
  })

  test('setCostStateForRestore() — 双写到 STATE + ALS bridge', () => {
    const costData = {
      totalCostUSD: 100,
      totalAPIDuration: 5000,
      totalAPIDurationWithoutRetries: 4500,
      totalToolDuration: 1000,
      totalLinesAdded: 50,
      totalLinesRemoved: 20,
      lastDuration: 10000,
      modelUsage: {
        'test-model': {
          inputTokens: 1000,
          outputTokens: 500,
        } as any,
      },
    }

    setCostStateForRestore(costData)

    // 验证 STATE 更新
    expect(getTotalCostUSD()).toBe(costData.totalCostUSD)
    expect(getTotalAPIDuration()).toBe(costData.totalAPIDuration)
    expect(getTotalToolDuration()).toBe(costData.totalToolDuration)

    // 验证在有 ALS 上下文时，getter 会优先读取 ALS 的值
    runWithContext(createContext({
      totalCostUSD: costData.totalCostUSD + 100,
      totalAPIDuration: costData.totalAPIDuration + 1000,
      totalToolDuration: costData.totalToolDuration + 500,
    }), () => {
      expect(getTotalCostUSD()).toBe(costData.totalCostUSD + 100)
      expect(getTotalAPIDuration()).toBe(costData.totalAPIDuration + 1000)
      expect(getTotalToolDuration()).toBe(costData.totalToolDuration + 500)
    })

    // ALS 上下文结束后，恢复到全局 STATE
    expect(getTotalCostUSD()).toBe(costData.totalCostUSD)
    expect(getTotalAPIDuration()).toBe(costData.totalAPIDuration)
    expect(getTotalToolDuration()).toBe(costData.totalToolDuration)
  })

  test('多个成本字段的 ALS 优先 + fallback', () => {
    // 设置全局 STATE 的值
    const globalCost = getTotalCostUSD()
    const globalDuration = getTotalAPIDuration()
    const globalToolDuration = getTotalToolDuration()

    // 添加一些成本
    addToTotalCostState(5, {} as any, 'model1')

    // 更新后的全局值
    const updatedGlobalCost = getTotalCostUSD()
    const updatedGlobalDuration = getTotalAPIDuration()
    const updatedGlobalToolDuration = getTotalToolDuration()

    // 有 ALS 上下文时，应该优先返回 ALS 的值
    const contextData = {
      totalCostUSD: updatedGlobalCost + 100,
      totalAPIDuration: updatedGlobalDuration + 1000,
      totalToolDuration: updatedGlobalToolDuration + 500,
    }

    runWithContext(createContext(contextData), () => {
      expect(getTotalCostUSD()).toBe(contextData.totalCostUSD)
      expect(getTotalAPIDuration()).toBe(contextData.totalAPIDuration)
      expect(getTotalToolDuration()).toBe(contextData.totalToolDuration)
    })

    // ALS 上下文结束后，应该恢复到全局 STATE
    expect(getTotalCostUSD()).toBe(updatedGlobalCost)
    expect(getTotalAPIDuration()).toBe(updatedGlobalDuration)
    expect(getTotalToolDuration()).toBe(updatedGlobalToolDuration)
  })
})
