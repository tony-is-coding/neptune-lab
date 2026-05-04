/**
 * observability/NoOpMetricsProvider.ts — 零开销 Metrics Provider
 *
 * 空实现的 Metrics Provider，用于：
 * - 默认配置（不启用指标采集时）
 * - 测试环境（避免副作用）
 *
 * 所有方法都是空实现，确保零开销。
 */

import type { IMetricsProvider } from './IMetricsProvider'
import type { Counter, Gauge, Histogram, Timer } from './types'

/**
 * 零开销 Counter 实现
 */
class NoOpCounter implements Counter {
  increment(_value?: number): void {
    // 空实现
  }
}

/**
 * 零开销 Gauge 实现
 */
class NoOpGauge implements Gauge {
  set(_value: number): void {
    // 空实现
  }
}

/**
 * 零开销 Histogram 实现
 */
class NoOpHistogram implements Histogram {
  record(_value: number, _attributes?: Record<string, unknown>): void {
    // 空实现
  }
}

/**
 * 零开销 Timer 实现
 */
class NoOpTimer implements Timer {
  private startTime: number | null = null

  start(): void {
    this.startTime = Date.now()
  }

  stop(): number {
    if (this.startTime === null) {
      return 0
    }
    const elapsed = Date.now() - this.startTime
    this.startTime = null
    return elapsed
  }
}

/**
 * 零开销 Metrics Provider
 *
 * 所有方法返回空实现的指标，不执行任何实际操作。
 */
export class NoOpMetricsProvider implements IMetricsProvider {
  private static instance: NoOpMetricsProvider | null = null

  private constructor() {}

  /**
   * 获取全局单例
   */
  static getInstance(): NoOpMetricsProvider {
    if (!NoOpMetricsProvider.instance) {
      NoOpMetricsProvider.instance = new NoOpMetricsProvider()
    }
    return NoOpMetricsProvider.instance
  }

  counter(_name: string): Counter {
    return new NoOpCounter()
  }

  gauge(_name: string): Gauge {
    return new NoOpGauge()
  }

  histogram(_name: string): Histogram {
    return new NoOpHistogram()
  }

  timer(_name: string): Timer {
    return new NoOpTimer()
  }

  dispose(): void {
    // 空实现
  }
}
