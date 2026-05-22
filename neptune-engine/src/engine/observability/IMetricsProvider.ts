/**
 * observability/IMetricsProvider.ts — 指标采集 Provider 接口
 *
 * 定义 Metrics Provider 接口，遵循 LogProvider 设计风格：
 * - 简洁的接口定义
 * - 可选的 dispose 方法
 * - 支持多种指标类型
 */

import type {Counter, Gauge, Histogram, Timer} from './types'

/**
 * Metrics Provider 接口
 *
 * 负责创建和管理各种类型的指标。
 */
export interface IMetricsProvider {
	/**
	 * 创建或获取一个计数器
	 * @param name 指标名称
	 * @returns Counter 实例
	 */
	counter(name: string): Counter

	/**
	 * 创建或获取一个仪表
	 * @param name 指标名称
	 * @returns Gauge 实例
	 */
	gauge(name: string): Gauge

	/**
	 * 创建或获取一个直方图
	 * @param name 指标名称
	 * @returns Histogram 实例
	 */
	histogram(name: string): Histogram

	/**
	 * 创建或获取一个计时器
	 * @param name 指标名称
	 * @returns Timer 实例
	 */
	timer(name: string): Timer

	/**
	 * 释放资源（可选）
	 */
	dispose?(): void
}
