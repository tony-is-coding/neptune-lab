/**
 * observability/index.ts — 可观测性模块统一导出
 */

// 类型定义
export type { Span, Counter, Gauge, Histogram, Timer } from './types'
export { SpanStatus } from './types'

// Provider 接口
export type { ITracingProvider } from './ITracingProvider'
export type { IMetricsProvider } from './IMetricsProvider'

// 默认实现
export { NoOpTracingProvider } from './NoOpTracingProvider'
export { NoOpMetricsProvider } from './NoOpMetricsProvider'
export { InMemoryMetricsProvider } from './InMemoryMetricsProvider'
