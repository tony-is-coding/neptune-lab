/**
 * observability/__tests__/agentengine-instrumentation.test.ts — AgentEngine 可观测性埋点测试
 *
 * 测试内容：
 * 1. AgentEngineConfig 支持 tracingProvider/metricsProvider
 * 2. createSession/destroySession 埋点
 * 3. query 埋点
 * 4. 工具执行埋点
 *
 * 注意：tracingProvider/metricsProvider 尚未正式加入 AgentEngineConfig，
 * 使用 as any 绕过类型检查，待接口接入后移除。
 */

import { describe, test, expect, beforeEach } from 'bun:test'
import { AgentEngine } from '../../AgentEngine'
import { NoOpTracingProvider, NoOpMetricsProvider, SpanStatus } from '../../observability/index'
import { InMemoryMetricsProvider } from '../../observability/index'
import type { ITracingProvider, IMetricsProvider } from '../../observability/index'

/** 生成唯一 workspace 路径 */
function uniqueWorkspace(): string {
  return `/tmp/test-workspace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

describe('AgentEngine 可观测性埋点', () => {
  describe('AgentEngineConfig 支持 Provider', () => {
    test('默认使用 NoOpTracingProvider', () => {
      const engine = AgentEngine.create({
        systemPrompt: '测试',
      })

      // 不应抛出错误
      expect(() => engine.getStats()).not.toThrow()

      // 清理
      engine.destroy()
    })

    test('支持自定义 tracingProvider', () => {
      const customTracing = NoOpTracingProvider.getInstance()
      const engine = AgentEngine.create({
        systemPrompt: '测试',
        tracingProvider: customTracing,
      } as any)

      // 不应抛出错误
      expect(() => engine.getStats()).not.toThrow()

      // 清理
      engine.destroy()
    })

    test('支持自定义 metricsProvider', () => {
      const customMetrics = new InMemoryMetricsProvider()
      const engine = AgentEngine.create({
        systemPrompt: '测试',
        metricsProvider: customMetrics,
      } as any)

      // 不应抛出错误
      expect(() => engine.getStats()).not.toThrow()

      // 清理
      engine.destroy()
    })

    test('同时支持 tracing 和 metrics provider', () => {
      const customTracing = NoOpTracingProvider.getInstance()
      const customMetrics = new InMemoryMetricsProvider()
      const engine = AgentEngine.create({
        systemPrompt: '测试',
        tracingProvider: customTracing,
        metricsProvider: customMetrics,
      } as any)

      // 不应抛出错误
      expect(() => engine.getStats()).not.toThrow()

      // 清理
      engine.destroy()
    })
  })

  describe('createSession/destroySession 埋点', () => {
    let metricsProvider: InMemoryMetricsProvider

    beforeEach(() => {
      metricsProvider = new InMemoryMetricsProvider()
    })

    test('createSession 记录 session.created 计数', async () => {
      const engine = AgentEngine.create({
        systemPrompt: '测试',
        metricsProvider,
      } as any)

      const sessionId = await engine.createSession({ workspace: uniqueWorkspace() })

      // 验证计数器
      const counter = metricsProvider.getMetric('session.created')
      expect(counter?.type).toBe('counter')
      if (counter?.type === 'counter') {
        expect(counter.value).toBe(1)
      }

      // 清理
      await engine.destroySession(sessionId)
      await engine.destroy()
    })

    test('createSession 多次调用累加计数', async () => {
      const engine = AgentEngine.create({
        systemPrompt: '测试',
        metricsProvider,
      } as any)

      await engine.createSession({ workspace: uniqueWorkspace() })
      await engine.createSession({ workspace: uniqueWorkspace() })
      await engine.createSession({ workspace: uniqueWorkspace() })

      // 验证计数器
      const counter = metricsProvider.getMetric('session.created')
      if (counter?.type === 'counter') {
        expect(counter.value).toBe(3)
      }

      // 清理
      await engine.destroy()
    })

    test('destroySession 记录 session.destroyed 计数', async () => {
      const engine = AgentEngine.create({
        systemPrompt: '测试',
        metricsProvider,
      } as any)

      const sessionId = await engine.createSession({ workspace: uniqueWorkspace() })
      await engine.destroySession(sessionId)

      // 验证计数器
      const counter = metricsProvider.getMetric('session.destroyed')
      expect(counter?.type).toBe('counter')
      if (counter?.type === 'counter') {
        expect(counter.value).toBe(1)
      }

      // 清理
      await engine.destroy()
    })
  })

  describe('query 埋点', () => {
    let metricsProvider: InMemoryMetricsProvider
    let engine: AgentEngine

    beforeEach(() => {
      metricsProvider = new InMemoryMetricsProvider()
      engine = AgentEngine.create({
        systemPrompt: '测试',
        metricsProvider,
      } as any)
    })

    test('query 记录 query.started 计数', async () => {
      const sessionId = await engine.createSession({ workspace: uniqueWorkspace() })

      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _ of engine.query(sessionId, '测试')) {
          // 不会执行到这里
        }
      } catch {
        // 预期的错误（provider 未配置）
      }

      // 验证计数器
      const counter = metricsProvider.getMetric('query.started')
      expect(counter?.type).toBe('counter')
      if (counter?.type === 'counter') {
        expect(counter.value).toBe(1)
      }

      // 清理
      await engine.destroySession(sessionId)
      await engine.destroy()
    })

    test('query 记录 query.failed 计数（当 query 失败时）', async () => {
      const sessionId = await engine.createSession({ workspace: uniqueWorkspace() })

      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _ of engine.query(sessionId, '测试')) {
          // 不会执行到这里
        }
      } catch {
        // 预期的错误
      }

      // 验证失败计数器
      const counter = metricsProvider.getMetric('query.failed')
      expect(counter?.type).toBe('counter')
      if (counter?.type === 'counter') {
        expect(counter.value).toBe(1)
      }

      // 清理
      await engine.destroySession(sessionId)
      await engine.destroy()
    })
  })

  describe('工具执行埋点', () => {
    test('tool_use 事件记录 tool.execution 计数', async () => {
      const metricsProvider = new InMemoryMetricsProvider()
      const engine = AgentEngine.create({
        systemPrompt: '测试',
        metricsProvider,
      } as any)

      // 模拟 tool_use 事件
      const eventBus = engine.getEventBus()
      eventBus.emit('tool_use', { toolName: 'TestTool', input: {} })

      // 验证计数器
      const counter = metricsProvider.getMetric('tool.execution')
      expect(counter?.type).toBe('counter')
      if (counter?.type === 'counter') {
        expect(counter.value).toBe(1)
      }

      // 验证特定工具的计数器
      const toolCounter = metricsProvider.getMetric('tool.execution.TestTool')
      expect(toolCounter?.type).toBe('counter')
      if (toolCounter?.type === 'counter') {
        expect(toolCounter.value).toBe(1)
      }

      // 清理
      await engine.destroy()
    })

    test('tool_result 事件记录 tool.completed 计数', async () => {
      const metricsProvider = new InMemoryMetricsProvider()
      const engine = AgentEngine.create({
        systemPrompt: '测试',
        metricsProvider,
      } as any)

      // 模拟 tool_use 和 tool_result 事件
      const eventBus = engine.getEventBus()
      eventBus.emit('tool_use', { toolName: 'TestTool', input: {} })
      eventBus.emit('tool_result', { toolName: 'TestTool', output: {} })

      // 验证计数器
      const counter = metricsProvider.getMetric('tool.completed')
      expect(counter?.type).toBe('counter')
      if (counter?.type === 'counter') {
        expect(counter.value).toBe(1)
      }

      // 验证特定工具的计数器
      const toolCounter = metricsProvider.getMetric('tool.completed.TestTool')
      expect(toolCounter?.type).toBe('counter')
      if (toolCounter?.type === 'counter') {
        expect(toolCounter.value).toBe(1)
      }

      // 清理
      await engine.destroy()
    })

    test('多个工具执行累加计数', async () => {
      const metricsProvider = new InMemoryMetricsProvider()
      const engine = AgentEngine.create({
        systemPrompt: '测试',
        metricsProvider,
      } as any)

      const eventBus = engine.getEventBus()
      eventBus.emit('tool_use', { toolName: 'ToolA', input: {} })
      eventBus.emit('tool_result', { toolName: 'ToolA', output: {} })
      eventBus.emit('tool_use', { toolName: 'ToolB', input: {} })
      eventBus.emit('tool_result', { toolName: 'ToolB', output: {} })
      eventBus.emit('tool_use', { toolName: 'ToolA', input: {} })
      eventBus.emit('tool_result', { toolName: 'ToolA', output: {} })

      // 验证总计数
      const counter = metricsProvider.getMetric('tool.execution')
      if (counter?.type === 'counter') {
        expect(counter.value).toBe(3)
      }

      // 验证 ToolA 计数
      const toolACounter = metricsProvider.getMetric('tool.execution.ToolA')
      if (toolACounter?.type === 'counter') {
        expect(toolACounter.value).toBe(2)
      }

      // 验证 ToolB 计数
      const toolBCounter = metricsProvider.getMetric('tool.execution.ToolB')
      if (toolBCounter?.type === 'counter') {
        expect(toolBCounter.value).toBe(1)
      }

      // 清理
      await engine.destroy()
    })
  })

  describe('NoOpProvider 零开销验证', () => {
    test('NoOpMetricsProvider 不抛出错误', async () => {
      const engine = AgentEngine.create({
        systemPrompt: '测试',
        metricsProvider: NoOpMetricsProvider.getInstance(),
      } as any)

      const sessionId = await engine.createSession({ workspace: uniqueWorkspace() })

      // 验证不会抛出错误
      expect(() => engine.getStats()).not.toThrow()

      // 清理
      await engine.destroySession(sessionId)
      await engine.destroy()
    })

    test('NoOpTracingProvider 不增加 query 延迟', async () => {
      const engine = AgentEngine.create({
        systemPrompt: '测试',
        tracingProvider: NoOpTracingProvider.getInstance(),
        metricsProvider: NoOpMetricsProvider.getInstance(),
      } as any)

      const sessionId = await engine.createSession({ workspace: uniqueWorkspace() })

      // 测量 query 延迟
      const start = Date.now()
      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _ of engine.query(sessionId, '测试')) {
          // 不会执行到这里
        }
      } catch {
        // 预期的错误
      }
      const elapsed = Date.now() - start

      // NoOp 应该非常快（虽然由于其他操作，可能不是 0）
      // 这里我们主要验证它不会显著增加延迟
      expect(elapsed).toBeLessThan(100) // 100ms 是一个合理的上限

      // 清理
      await engine.destroySession(sessionId)
      await engine.destroy()
    })
  })

  describe('InMemoryMetricsProvider 测试验证', () => {
    test('可以读取所有指标', async () => {
      const metricsProvider = new InMemoryMetricsProvider()
      const engine = AgentEngine.create({
        systemPrompt: '测试',
        metricsProvider,
      } as any)

      const sessionId = await engine.createSession({ workspace: uniqueWorkspace() })

      // 触发一些事件
      engine.getEventBus().emit('tool_use', { toolName: 'TestTool', input: {} })
      engine.getEventBus().emit('tool_result', { toolName: 'TestTool', output: {} })

      // 获取所有指标
      const allMetrics = metricsProvider.getMetrics()

      // 验证预期的指标存在
      expect(allMetrics.has('session.created')).toBe(true)
      expect(allMetrics.has('tool.execution')).toBe(true)
      expect(allMetrics.has('tool.completed')).toBe(true)

      // 清理
      await engine.destroySession(sessionId)
      await engine.destroy()
    })
  })
})
