/**
 * observability/types.ts — 可观测性核心类型定义
 *
 * 定义 Tracing 和 Metrics 的核心类型：
 * - SpanStatus: Span 状态枚举
 * - Span: 分布式追踪 Span 接口
 * - Counter/Gauge/Histogram/Timer: 指标类型接口
 *
 * 设计原则：
 * - 与 LogProvider 设计风格一致（Provider 模式）
 * - 接口简洁，易于实现
 * - 支持零开销的 NoOp 实现
 */

/**
 * Span 状态
 */
export enum SpanStatus {
	/** 未设置状态 */
	UNSET = 'unset',
	/** 操作成功完成 */
	OK = 'ok',
	/** 操作失败 */
	ERROR = 'error',
}

/**
 * 分布式追踪 Span 接口
 *
 * 表示一个操作的时间跨度，可包含嵌套子 Span。
 */
export interface Span {
	/** Span 名称 */
	readonly name: string
	/** 结构化属性 */
	readonly attributes: Record<string, unknown>

	/** 设置 Span 状态 */
	setStatus(status: SpanStatus): Span

	/** 添加事件 */
	addEvent(name: string, attributes?: Record<string, unknown>): Span

	/** 结束 Span */
	end(): void
}

/**
 * 计数器接口
 *
 * 用于单调递增的计数，如请求总数、错误总数。
 */
export interface Counter {
	/** 增加计数值（默认 +1） */
	increment(value?: number): void
}

/**
 * 仪表接口
 *
 * 用于表示可增可减的瞬时值，如当前连接数、队列长度。
 */
export interface Gauge {
	/** 设置当前值 */
	set(value: number): void
}

/**
 * 直方图接口
 *
 * 用于记录值的分布，如请求延迟、消息大小。
 */
export interface Histogram {
	/** 记录一个值 */
	record(value: number, attributes?: Record<string, unknown>): void
}

/**
 * 计时器接口
 *
 * 用于测量操作耗时。
 */
export interface Timer {
	/** 开始计时 */
	start(): void

	/** 停止计时并返回耗时（毫秒） */
	stop(): number
}
