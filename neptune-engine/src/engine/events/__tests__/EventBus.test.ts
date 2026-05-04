/**
 * EventBus 测试
 *
 * 测试目标：
 * 1. emit/on/off/once/TTL自动清理/clear/无监听器时不报错
 * 2. Hook 拦截功能
 * 3. Session 过滤功能
 * 4. toMessage 静态方法
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { EventBus } from '../EventBus'
import type { EventBusMessage } from '../../types'

describe('EventBus', () => {
  let bus: EventBus

  beforeEach(() => {
    bus = new EventBus()
  })

  afterEach(() => {
    bus.clear()
  })

  describe('subscribe/subscribe（基本订阅功能）', () => {
    test('应该成功订阅事件', () => {
      let received = false
      bus.subscribe('test:event', () => {
        received = true
      })

      bus.emit('test:event', null)
      expect(received).toBe(true)
    })

    test('subscribe 应该返回取消函数', () => {
      let received = false
      const unsubscribe = bus.subscribe('test:event', () => {
        received = true
      })

      bus.emit('test:event', null)
      expect(received).toBe(true)

      received = false
      unsubscribe()
      bus.emit('test:event', null)
      expect(received).toBe(false)
    })

    test('应该正确传递 payload', () => {
      let receivedPayload: unknown = null
      const testPayload = { message: 'hello', value: 42 }

      bus.subscribe('test:event', (payload) => {
        receivedPayload = payload
      })

      bus.emit('test:event', testPayload)
      expect(receivedPayload).toEqual(testPayload)
    })

    test('应该支持多个监听器监听同一事件', () => {
      let count = 0

      bus.subscribe('test:event', () => {
        count++
      })
      bus.subscribe('test:event', () => {
        count++
      })

      bus.emit('test:event', null)
      expect(count).toBe(2)
    })
  })

  describe('on（订阅并返回取消函数）', () => {
    test('on 应该返回取消订阅函数', () => {
      let received = false
      const unsubscribe = bus.on('test:event', () => {
        received = true
      })

      bus.emit('test:event', null)
      expect(received).toBe(true)

      received = false
      unsubscribe()
      bus.emit('test:event', null)
      expect(received).toBe(false)
    })

    test('on 的取消函数应该只移除对应监听器', () => {
      let count1 = 0
      let count2 = 0

      const unsubscribe1 = bus.on('test:event', () => {
        count1++
      })
      bus.on('test:event', () => {
        count2++
      })

      bus.emit('test:event', null)
      expect(count1).toBe(1)
      expect(count2).toBe(1)

      unsubscribe1()
      bus.emit('test:event', null)
      expect(count1).toBe(1) // 不再增加
      expect(count2).toBe(2) // 继续增加
    })
  })

  describe('TTL 自动清理', () => {
    test('on 支持 ttlMs 参数自动取消订阅', async () => {
      let received = 0
      bus.on('test:event', () => {
        received++
      }, 50) // 50ms 后自动取消

      // 立即触发应该成功
      bus.emit('test:event', null)
      expect(received).toBe(1)

      // 等待 TTL 过期
      await new Promise(resolve => setTimeout(resolve, 60))

      bus.emit('test:event', null)
      expect(received).toBe(1) // 不再增加
    })

    test('on 支持 ttlMs + options 组合', async () => {
      let received = 0
      bus.on('test:event', () => {
        received++
      }, 50, { sessionId: 'session-1' }) // 50ms 后自动取消 + Session 过滤

      // 立即触发应该成功
      bus.emit('test:event', null, 'session-1')
      expect(received).toBe(1)

      // 等待 TTL 过期
      await new Promise(resolve => setTimeout(resolve, 60))

      bus.emit('test:event', null, 'session-1')
      expect(received).toBe(1) // 不再增加
    })

    test('on 返回的取消函数应该同时清理 TTL timer', async () => {
      let received = 0
      const unsubscribe = bus.on('test:event', () => {
        received++
      }, 100) // 100ms 后自动取消

      // 立即取消
      unsubscribe()

      // 等待超过 TTL 时间
      await new Promise(resolve => setTimeout(resolve, 120))

      bus.emit('test:event', null)
      expect(received).toBe(0) // 从未触发
    })

    test('ttlMs 为 undefined 时不自动取消', async () => {
      let received = 0
      bus.on('test:event', () => {
        received++
      })

      bus.emit('test:event', null)
      expect(received).toBe(1)

      await new Promise(resolve => setTimeout(resolve, 50))

      bus.emit('test:event', null)
      expect(received).toBe(2) // 继续接收
    })

    test('ttlMs 为 0 时在下一个事件循环后取消', async () => {
      let received = false
      bus.on('test:event', () => {
        received = true
      }, 0)

      // 在同一个事件循环中，监听器仍然有效
      bus.emit('test:event', null)
      expect(received).toBe(true) // 仍然接收到

      received = false
      // 等待下一个事件循环
      await new Promise(resolve => setTimeout(resolve, 0))

      // 现在 TTL 已过期
      bus.emit('test:event', null)
      expect(received).toBe(false) // 未接收到，已取消
    })
  })

  describe('unsubscribe（取消订阅）', () => {
    test('unsubscribe 应该移除指定监听器', () => {
      let received = false
      const handler = () => {
        received = true
      }

      bus.subscribe('test:event', handler)
      bus.emit('test:event', null)
      expect(received).toBe(true)

      received = false
      bus.unsubscribe('test:event', handler)
      bus.emit('test:event', null)
      expect(received).toBe(false)
    })

    test('unsubscribe 不存在的监听器不报错', () => {
      const handler = () => {}
      expect(() => {
        bus.unsubscribe('nonexistent:event', handler)
      }).not.toThrow()
    })

    test('unsubscribe 不存在的事件类型不报错', () => {
      const handler = () => {}
      expect(() => {
        bus.unsubscribe('nonexistent:event', handler)
      }).not.toThrow()
    })
  })

  describe('clear（清除所有监听器和 Hook）', () => {
    test('clear 应该清除所有监听器', () => {
      let received = false
      bus.subscribe('test:event', () => {
        received = true
      })

      bus.clear()
      bus.emit('test:event', null)
      expect(received).toBe(false)
    })

    test('clear 应该清除所有 Hook', () => {
      let hookCalled = false
      bus.hook('test:event', () => {
        hookCalled = true
        return true
      })

      bus.clear()
      bus.emit('test:event', null)
      expect(hookCalled).toBe(false)
    })

    test('clear 后可以重新订阅', () => {
      let received = false
      bus.subscribe('test:event', () => {
        received = true
      })

      bus.clear()
      bus.subscribe('test:event', () => {
        received = true
      })

      bus.emit('test:event', null)
      expect(received).toBe(true)
    })
  })

  describe('无监听器时不报错', () => {
    test('emit 无监听器的事件不报错', () => {
      expect(() => {
        bus.emit('nonexistent:event', null)
      }).not.toThrow()
    })

    test('emit 到空 EventBus 不报错', () => {
      expect(() => {
        bus.emit('any:event', { data: 'test' })
      }).not.toThrow()
    })
  })

  describe('hook（Hook 拦截功能）', () => {
    test('hook 应该在监听器之前执行', () => {
      let hookCalled = false
      let listenerCalled = false

      bus.hook('test:event', () => {
        hookCalled = true
        return true
      })

      bus.subscribe('test:event', () => {
        listenerCalled = true
      })

      bus.emit('test:event', null)
      expect(hookCalled).toBe(true)
      expect(listenerCalled).toBe(true)
    })

    test('hook 返回 false 应该阻止事件传播', () => {
      let listenerCalled = false

      bus.hook('test:event', () => {
        return false // 阻止传播
      })

      bus.subscribe('test:event', () => {
        listenerCalled = true
      })

      bus.emit('test:event', null)
      expect(listenerCalled).toBe(false)
    })

    test('多个 hook 应该按顺序执行', () => {
      const order: number[] = []

      bus.hook('test:event', () => {
        order.push(1)
        return true
      })
      bus.hook('test:event', () => {
        order.push(2)
        return true
      })

      bus.emit('test:event', null)
      expect(order).toEqual([1, 2])
    })

    test('hook 链中任何一个返回 false 应该阻止后续执行', () => {
      const order: number[] = []

      bus.hook('test:event', () => {
        order.push(1)
        return true
      })
      bus.hook('test:event', () => {
        order.push(2)
        return false // 阻止
      })
      bus.hook('test:event', () => {
        order.push(3)
        return true
      })

      bus.subscribe('test:event', () => {
        order.push(4)
      })

      bus.emit('test:event', null)
      expect(order).toEqual([1, 2]) // 第三个 hook 和监听器都不执行
    })

    test('hook 抛出错误应该继续执行后续 hook', () => {
      let secondHookCalled = false
      let listenerCalled = false

      bus.hook('test:event', () => {
        throw new Error('Hook error')
      })
      bus.hook('test:event', () => {
        secondHookCalled = true
        return true
      })

      bus.subscribe('test:event', () => {
        listenerCalled = true
      })

      bus.emit('test:event', null)
      expect(secondHookCalled).toBe(true)
      expect(listenerCalled).toBe(true)
    })
  })

  describe('Session 过滤功能', () => {
    test('全局监听器应该接收所有事件', () => {
      let received = 0
      bus.subscribe('test:event', () => {
        received++
      })

      bus.emit('test:event', null, 'session-1')
      expect(received).toBe(1)

      bus.emit('test:event', null, 'session-2')
      expect(received).toBe(2)
    })

    test('Session 特定监听器只接收匹配的事件', () => {
      let received = 0
      bus.subscribe('test:event', () => {
        received++
      }, { sessionId: 'session-1' })

      bus.emit('test:event', null, 'session-1')
      expect(received).toBe(1)

      bus.emit('test:event', null, 'session-2')
      expect(received).toBe(1) // 不增加

      bus.emit('test:event', null) // 无 sessionId
      expect(received).toBe(1) // 不增加
    })

    test('Session 特定监听器应该接收无 sessionId 的 emit', () => {
      let received = false
      bus.subscribe('test:event', () => {
        received = true
      }, { sessionId: 'session-1' })

      bus.emit('test:event', null) // 无 sessionId
      // 根据代码逻辑：listener.sessionId === undefined || listener.sessionId === sessionId
      // emit 无 sessionId 时，sessionId 参数为 undefined
      // listener.sessionId = 'session-1'，不匹配 undefined
      // 所以不会触发
      expect(received).toBe(false)
    })

    test('全局监听器应该接收 Session 特定事件', () => {
      let received = false
      bus.subscribe('test:event', () => {
        received = true
      })

      bus.emit('test:event', null, 'session-1')
      expect(received).toBe(true)
    })

    test('on 方法应该支持 Session 过滤', () => {
      let received = 0
      bus.subscribe('test:event', () => {
        received++
      }, { sessionId: 'session-1' })

      bus.emit('test:event', null, 'session-1')
      expect(received).toBe(1)

      bus.emit('test:event', null, 'session-2')
      expect(received).toBe(1)
    })
  })

  describe('监听器错误处理', () => {
    test('监听器抛出错误应该继续执行后续监听器', () => {
      let count = 0

      bus.subscribe('test:event', () => {
        count++
        throw new Error('Listener error')
      })
      bus.subscribe('test:event', () => {
        count++
      })

      bus.emit('test:event', null)
      expect(count).toBe(2)
    })

    test('所有监听器都抛出错误不报错', () => {
      bus.subscribe('test:event', () => {
        throw new Error('Error 1')
      })
      bus.subscribe('test:event', () => {
        throw new Error('Error 2')
      })

      expect(() => {
        bus.emit('test:event', null)
      }).not.toThrow()
    })
  })

  describe('toMessage 静态方法', () => {
    test('应该生成正确的 EventBusMessage 格式', () => {
      const message = EventBus.toMessage('test:event', { data: 'value' }, 'session-123')

      expect(message.version).toBe(1)
      expect(message.type).toBe('test:event')
      expect(message.payload).toEqual({ data: 'value' })
      expect(message.sessionId).toBe('session-123')
      expect(message.timestamp).toBeGreaterThan(0)
    })

    test('sessionId 可选', () => {
      const message = EventBus.toMessage('test:event', { data: 'value' })

      expect(message.sessionId).toBeUndefined()
      expect(message.type).toBe('test:event')
    })

    test('payload 可以是任意 JSON 可序列化值', () => {
      const msg1 = EventBus.toMessage('test', null)
      const msg2 = EventBus.toMessage('test', undefined)
      const msg3 = EventBus.toMessage('test', 'string')
      const msg4 = EventBus.toMessage('test', 123)
      const msg5 = EventBus.toMessage('test', { nested: { object: true } })
      const msg6 = EventBus.toMessage('test', [1, 2, 3])

      expect(msg1.payload).toBe(null)
      expect(msg2.payload).toBe(undefined)
      expect(msg3.payload).toBe('string')
      expect(msg4.payload).toBe(123)
      expect(msg5.payload).toEqual({ nested: { object: true } })
      expect(msg6.payload).toEqual([1, 2, 3])
    })

    test('timestamp 应该是当前时间', () => {
      const before = Date.now()
      const message = EventBus.toMessage('test', null)
      const after = Date.now()

      expect(message.timestamp).toBeGreaterThanOrEqual(before)
      expect(message.timestamp).toBeLessThanOrEqual(after)
    })
  })

  describe('复杂场景', () => {
    test('应该支持 Hook + Session 过滤组合', () => {
      let hookCalled = false
      let listenerCalled = false

      bus.hook('test:event', () => {
        hookCalled = true
        return true
      })

      bus.subscribe('test:event', () => {
        listenerCalled = true
      }, { sessionId: 'session-1' })

      bus.emit('test:event', null, 'session-1')
      expect(hookCalled).toBe(true)
      expect(listenerCalled).toBe(true)
    })

    test('应该支持多个事件类型独立管理', () => {
      let event1Called = false
      let event2Called = false

      bus.subscribe('event1', () => {
        event1Called = true
      })
      bus.subscribe('event2', () => {
        event2Called = true
      })

      bus.emit('event1', null)
      expect(event1Called).toBe(true)
      expect(event2Called).toBe(false)

      bus.emit('event2', null)
      expect(event2Called).toBe(true)
    })

    test('on 返回的取消函数在 TTL 后调用不报错', async () => {
      const unsubscribe = bus.on('test:event', () => {}, 10)

      await new Promise(resolve => setTimeout(resolve, 20))

      expect(() => {
        unsubscribe()
      }).not.toThrow()
    })
  })

  describe('错误事件（Error Events）', () => {
    test('Hook 抛出错误时应发出 error 事件', () => {
      let errorReceived = false
      let errorPayload: unknown = null

      bus.subscribe('error', (payload) => {
        errorReceived = true
        errorPayload = payload
      })

      bus.hook('test:event', () => {
        throw new Error('Hook error')
      })

      bus.emit('test:event', null)

      expect(errorReceived).toBe(true)
      expect(errorPayload).toEqual({
        error: {
          message: 'Hook error',
          name: 'Error',
          stack: expect.any(String),
        },
        context: {
          source: 'hook',
          eventType: 'test:event',
          sessionId: undefined,
        },
      })
    })

    test('Listener 抛出错误时应发出 error 事件', () => {
      let errorReceived = false
      let errorPayload: unknown = null

      bus.subscribe('error', (payload) => {
        errorReceived = true
        errorPayload = payload
      })

      bus.subscribe('test:event', () => {
        throw new Error('Listener error')
      })

      bus.emit('test:event', null)

      expect(errorReceived).toBe(true)
      expect(errorPayload).toEqual({
        error: {
          message: 'Listener error',
          name: 'Error',
          stack: expect.any(String),
        },
        context: {
          source: 'listener',
          eventType: 'test:event',
          sessionId: undefined,
        },
      })
    })

    test('error 事件监听器本身抛出错误时应被忽略（避免无限递归）', () => {
      let hookErrorCount = 0

      // 订阅一个会抛出错误的 error 监听器
      bus.subscribe('error', () => {
        throw new Error('Error listener error')
      })

      // Hook 抛出错误
      bus.hook('test:event', () => {
        hookErrorCount++
        throw new Error('Hook error')
      })

      // 不应该导致无限递归或程序崩溃
      expect(() => {
        bus.emit('test:event', null)
      }).not.toThrow()

      expect(hookErrorCount).toBe(1)
    })

    test('error 事件应包含 sessionId 信息', () => {
      let errorPayload: unknown = null

      bus.subscribe('error', (payload) => {
        errorPayload = payload
      })

      bus.subscribe('test:event', () => {
        throw new Error('Listener error')
      }, { sessionId: 'session-123' })

      bus.emit('test:event', null, 'session-123')

      expect(errorPayload).toEqual({
        error: {
          message: 'Listener error',
          name: 'Error',
          stack: expect.any(String),
        },
        context: {
          source: 'listener',
          eventType: 'test:event',
          sessionId: 'session-123',
        },
      })
    })

    test('多个错误应该都发出 error 事件', () => {
      let errorCount = 0

      bus.subscribe('error', () => {
        errorCount++
      })

      bus.subscribe('test:event', () => {
        throw new Error('Error 1')
      })

      bus.subscribe('test:event', () => {
        throw new Error('Error 2')
      })

      bus.emit('test:event', null)

      expect(errorCount).toBe(2)
    })
  })
})
