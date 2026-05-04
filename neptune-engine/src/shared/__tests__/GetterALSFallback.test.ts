/**
 * Getter ALS 优先 + Fallback 测试
 *
 * 验证核心 getter 的 ALS 优先和 fallback 机制：
 * 1. 有 ALS 上下文时，优先从 ALS 读取
 * 2. 无 ALS 上下文时，fallback 到全局 STATE
 */

import { describe, test, expect, beforeEach } from 'bun:test'
import { resetStateForTests } from '../../bootstrap/state'
import {
  getCwdState,
  getSessionId,
  getProjectRoot,
  getOriginalCwd,
} from '../../bootstrap/state'
import {
  runWithContext,
  createContext,
  setCwd,
  setSessionId,
  setProjectRoot,
  setOriginalCwd,
} from '../SessionContextBridge'

describe('Getter ALS 优先 + Fallback', () => {
  beforeEach(() => {
    // 重置全局状态
    resetStateForTests()
  })

  test('getCwdState() — ALS 优先 + fallback', () => {
    // 获取全局 STATE 的当前值
    const globalCwd = getCwdState()

    // 无 ALS 上下文时，应该返回全局 STATE 的值
    expect(getCwdState()).toBe(globalCwd)

    // 有 ALS 上下文时，应该优先返回 ALS 的值
    const contextCwd = '/context/cwd'
    runWithContext(createContext({ cwd: contextCwd }), () => {
      expect(getCwdState()).toBe(contextCwd)
    })

    // ALS 上下文结束后，应该恢复到全局 STATE
    expect(getCwdState()).toBe(globalCwd)
  })

  test('getSessionId() — ALS 优先 + fallback', () => {
    // 全局 STATE 的 sessionId
    const globalSessionId = getSessionId()

    // 无 ALS 上下文时，应该返回全局 STATE 的值
    expect(getSessionId()).toBe(globalSessionId)

    // 有 ALS 上下文时，应该优先返回 ALS 的值
    const contextSessionId = 'context-session-id'
    runWithContext(createContext({ sessionId: contextSessionId }), () => {
      expect(getSessionId()).toBe(contextSessionId)
    })

    // ALS 上下文结束后，应该恢复到全局 STATE
    expect(getSessionId()).toBe(globalSessionId)
  })

  test('getProjectRoot() — ALS 优先 + fallback', () => {
    // 设置全局 STATE 的值
    const globalProjectRoot = getProjectRoot()

    // 无 ALS 上下文时，应该返回全局 STATE 的值
    expect(getProjectRoot()).toBe(globalProjectRoot)

    // 有 ALS 上下文时，应该优先返回 ALS 的值
    const contextProjectRoot = '/context/project'
    runWithContext(createContext({ projectRoot: contextProjectRoot }), () => {
      expect(getProjectRoot()).toBe(contextProjectRoot)
    })

    // ALS 上下文结束后，应该恢复到全局 STATE
    expect(getProjectRoot()).toBe(globalProjectRoot)
  })

  test('getOriginalCwd() — ALS 优先 + fallback', () => {
    // 设置全局 STATE 的值
    const globalOriginalCwd = getOriginalCwd()

    // 无 ALS 上下文时，应该返回全局 STATE 的值
    expect(getOriginalCwd()).toBe(globalOriginalCwd)

    // 有 ALS 上下文时，应该优先返回 ALS 的值
    const contextOriginalCwd = '/context/original'
    runWithContext(createContext({ originalCwd: contextOriginalCwd }), () => {
      expect(getOriginalCwd()).toBe(contextOriginalCwd)
    })

    // ALS 上下文结束后，应该恢复到全局 STATE
    expect(getOriginalCwd()).toBe(globalOriginalCwd)
  })

  test('多个字段的 ALS 优先 + fallback', () => {
    // 全局 STATE 的值
    const globalCwd = getCwdState()
    const globalSessionId = getSessionId()
    const globalProjectRoot = getProjectRoot()
    const globalOriginalCwd = getOriginalCwd()

    // 无 ALS 上下文时，应该返回全局 STATE 的值
    expect(getCwdState()).toBe(globalCwd)
    expect(getSessionId()).toBe(globalSessionId)
    expect(getProjectRoot()).toBe(globalProjectRoot)
    expect(getOriginalCwd()).toBe(globalOriginalCwd)

    // 有 ALS 上下文时，应该优先返回 ALS 的值
    const contextData = {
      cwd: '/context/cwd',
      sessionId: 'context-session-id',
      projectRoot: '/context/project',
      originalCwd: '/context/original',
    }

    runWithContext(createContext(contextData), () => {
      expect(getCwdState()).toBe(contextData.cwd)
      expect(getSessionId()).toBe(contextData.sessionId)
      expect(getProjectRoot()).toBe(contextData.projectRoot)
      expect(getOriginalCwd()).toBe(contextData.originalCwd)
    })

    // ALS 上下文结束后，应该恢复到全局 STATE
    expect(getCwdState()).toBe(globalCwd)
    expect(getSessionId()).toBe(globalSessionId)
    expect(getProjectRoot()).toBe(globalProjectRoot)
    expect(getOriginalCwd()).toBe(globalOriginalCwd)
  })
})
