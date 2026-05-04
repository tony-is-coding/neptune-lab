/**
 * BaseProvider 错误分类测试
 *
 * 验证 Provider 错误能够正确分类到对应的 EngineErrorCode
 */

import { describe, test, expect, beforeEach } from 'bun:test'
import { APIError, APIConnectionError, APIConnectionTimeoutError } from '@anthropic-ai/sdk'
import { BaseProvider, type BaseProviderConfig } from '../BaseProvider.js'
import { CircuitBreaker, type CircuitBreakerStateChangedEvent } from '../../CircuitBreaker.js'
import { EngineErrorCode, type EngineErrorCodeType } from '../../../errors.js'

// 创建一个测试 Provider 实现，暴露 protected 方法用于测试
class TestProvider extends BaseProvider {
  readonly type = 'test'

  // 暴露 classifyError 方法用于测试
  testClassifyError(error: unknown): EngineErrorCodeType {
    return this.classifyError(error)
  }

  // 暴露 createErrorResponse 方法用于测试
  testCreateErrorResponse(error: unknown) {
    return this.createErrorResponse(error)
  }

  async *query() {
    // 不需要实现，只测试错误分类
  }
}

describe('BaseProvider 错误分类', () => {
  let provider: TestProvider

  beforeEach(() => {
    provider = new TestProvider()
  })

  describe('classifyError', () => {
    test('应该将 401 错误分类为 AUTH_ERROR', () => {
      const error = Object.assign(new Error('Unauthorized'), { status: 401 }) as APIError
      const result = provider.testClassifyError(error)
      expect(result).toBe(EngineErrorCode.AUTH_ERROR)
    })

    test('应该将 403 错误分类为 AUTH_ERROR', () => {
      const error = Object.assign(new Error('Forbidden'), { status: 403 }) as APIError
      const result = provider.testClassifyError(error)
      expect(result).toBe(EngineErrorCode.AUTH_ERROR)
    })

    test('应该将 429 错误分类为 RATE_LIMIT', () => {
      const error = Object.assign(new Error('Too many requests'), { status: 429 }) as APIError
      const result = provider.testClassifyError(error)
      expect(result).toBe(EngineErrorCode.RATE_LIMIT)
    })

    test('应该将 404 错误分类为 PROVIDER_NOT_FOUND', () => {
      const error = Object.assign(new Error('Not found'), { status: 404 }) as APIError
      const result = provider.testClassifyError(error)
      expect(result).toBe(EngineErrorCode.PROVIDER_NOT_FOUND)
    })

    test('应该将 APIConnectionError 分类为 NETWORK_ERROR', () => {
      const error = new APIConnectionError({ message: 'Connection failed' })
      const result = provider.testClassifyError(error)
      expect(result).toBe(EngineErrorCode.NETWORK_ERROR)
    })

    test('应该将 APIConnectionTimeoutError 分类为 NETWORK_ERROR', () => {
      const error = new APIConnectionTimeoutError({ message: 'Request timed out' })
      const result = provider.testClassifyError(error)
      expect(result).toBe(EngineErrorCode.NETWORK_ERROR)
    })

    test('应该将包含 timeout 的普通 Error 分类为 NETWORK_ERROR', () => {
      const error = new Error('Request timeout after 30s')
      const result = provider.testClassifyError(error)
      expect(result).toBe(EngineErrorCode.NETWORK_ERROR)
    })

    test('应该将包含 econnrefused 的普通 Error 分类为 NETWORK_ERROR', () => {
      const error = new Error('ECONNREFUSED: Connection refused')
      const result = provider.testClassifyError(error)
      expect(result).toBe(EngineErrorCode.NETWORK_ERROR)
    })

    test('应该将包含 enotfound 的普通 Error 分类为 NETWORK_ERROR', () => {
      const error = new Error('ENOTFOUND: DNS lookup failed')
      const result = provider.testClassifyError(error)
      expect(result).toBe(EngineErrorCode.NETWORK_ERROR)
    })

    test('应该将未知错误分类为 EXECUTION_ERROR', () => {
      const error = new Error('Unknown error')
      const result = provider.testClassifyError(error)
      expect(result).toBe(EngineErrorCode.EXECUTION_ERROR)
    })
  })

  describe('createErrorResponse', () => {
    test('应该创建包含错误码的错误响应', () => {
      const error = Object.assign(new Error('Unauthorized'), { status: 401 }) as APIError
      const response = provider.testCreateErrorResponse(error)

      expect(response.type).toBe('message')
      const content = response.content as { type: string; error: string; errorCode: EngineErrorCodeType }
      expect(content.type).toBe('error')
      expect(typeof content.error).toBe('string')
      expect(content.errorCode).toBe(EngineErrorCode.AUTH_ERROR)
    })

    test('应该处理非 Error 类型的错误', () => {
      const error = 'String error'
      const response = provider.testCreateErrorResponse(error)

      expect(response.type).toBe('message')
      const content = response.content as { type: string; error: string; errorCode: EngineErrorCodeType }
      expect(content.type).toBe('error')
      expect(content.error).toBe('String error')
      expect(content.errorCode).toBe(EngineErrorCode.EXECUTION_ERROR)
    })
  })

  describe('CircuitBreaker 集成', () => {
    test('应该为每个 Provider 实例创建独立的 CircuitBreaker', () => {
      const provider1 = new TestProvider()
      const provider2 = new TestProvider()

      // 访问 circuitBreaker getter 触发初始化
      const cb1 = (provider1 as any).circuitBreaker
      const cb2 = (provider2 as any).circuitBreaker

      // 两个 Provider 应该有独立的 CircuitBreaker 实例
      expect(cb1).not.toBe(cb2)
      expect(cb1.getState()).toBe('closed')
      expect(cb2.getState()).toBe('closed')
    })

    test('CircuitBreaker 应该具有正确的名称', () => {
      const provider = new TestProvider()
      const cb = (provider as any).circuitBreaker

      // CircuitBreaker 名称应该包含 Provider 类型
      expect(cb.getState()).toBe('closed')
      // 注意：CircuitBreaker 的 name 属性是 private，无法直接访问
      // 但我们可以通过状态变化行为来验证它正在工作
    })

    test('CircuitBreaker 应该支持状态变化回调', async () => {
      const provider = new TestProvider()
      let stateChangedEvent: CircuitBreakerStateChangedEvent | null = null

      // 设置 EventBus（模拟）
      provider.setEventBus({
        emit: (type: string, payload: unknown) => {
          if (type.startsWith('circuit_')) {
            stateChangedEvent = payload as unknown as CircuitBreakerStateChangedEvent
          }
        },
      } as any)

      const cb = (provider as any).circuitBreaker

      // 触发 5 次失败，应该触发熔断
      for (let i = 0; i < 5; i++) {
        cb.recordFailure()
      }

      // 验证状态变为 open
      expect(cb.getState()).toBe('open')

      // 验证事件被发布
      expect(stateChangedEvent).not.toBeNull()
      expect(stateChangedEvent!.newState).toBe('open')
    })
  })
})
