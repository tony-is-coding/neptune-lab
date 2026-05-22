/**
 * EngineLogger — 可观测性模块核心日志接口
 *
 * 定义统一的日志级别和日志方法契约，
 * 所有 logger 实现（ConsoleLogger、自定义 logger）都必须满足此接口。
 */

/** 日志级别：debug < info < warn < error */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/** Engine 日志接口 */
export interface EngineLogger {
	debug(msg: string, attrs?: Record<string, unknown>): void

	info(msg: string, attrs?: Record<string, unknown>): void

	warn(msg: string, attrs?: Record<string, unknown>): void

	error(msg: string, attrs?: Record<string, unknown>): void

	/** 创建子 logger，继承父级属性和级别 */
	child(name: string): EngineLogger
}
