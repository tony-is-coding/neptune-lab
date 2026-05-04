/**
 * observability/ITracingProvider.ts — 分布式追踪 Provider 接口
 *
 * 定义 Tracing Provider 接口，遵循 LogProvider 设计风格：
 * - 简洁的接口定义
 * - 可选的 dispose 方法
 * - 支持 Span 创建和上下文管理
 */

import type { Span } from './types'

/**
 * Tracing Provider 接口
 *
 * 负责创建和管理分布式追踪 Span。
 */
export interface ITracingProvider {
  /**
   * 创建一个新的 Span
   * @param name Span 名称
   * @param attributes 结构化属性
   * @returns Span 实例
   */
  startSpan(name: string, attributes?: Record<string, unknown>): Span

  /**
   * 在当前 Span 上下文中执行函数
   * @param fn 要执行的函数
   * @returns 函数执行结果
   */
  runInSpan<T>(
    name: string,
    fn: (span: Span) => T,
    attributes?: Record<string, unknown>
  ): T

  /**
   * 释放资源（可选）
   */
  dispose?(): void
}
