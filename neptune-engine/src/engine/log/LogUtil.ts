/**
 * LogUtil — 全局日志入口（单例）
 *
 * 实现 EngineLogger 接口，提供：
 * - debug/info/warn/error 日志方法
 * - 级别过滤
 * - 调用位置捕获（可配置）
 * - 格式化 → 输出 → 持久化 完整流程
 * - child(name) 创建子 logger
 * - 全局单例管理：getInstance / initialize / shutdown
 */

import type {EngineLogger, LogLevel} from './EngineLogger'
import type {LogConfig, LogRecord} from './LogRecord'
import type {LogFormatter} from './LogFormatter'
import type {LogProvider} from './LogProvider'
import type {LogStore} from './LogStore'
import {StandardLogFormatter} from './StandardLogFormatter'
import {ConsoleLogProvider} from './ConsoleLogProvider'
import {FileLogStore} from './FileLogStore'
import {captureCallSite} from './callsite'
import {MDC} from './MDC'

/** 级别优先级映射，数值越大优先级越高 */
const LEVEL_PRIORITY: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
}

/** 已解析的完整配置（所有字段非可选） */
interface ResolvedConfig {
	level: LogLevel
	includeCallSite: boolean
	formatter: LogFormatter
	provider: LogProvider
	store: LogStore | null
}

export class LogUtil implements EngineLogger {
	private static instance: LogUtil | null = null

	private readonly config: ResolvedConfig
	/** 子 logger 名称链，如 ["engine", "session"] → "engine:session" */
	private readonly names: string[]

	private constructor(config: ResolvedConfig, names?: string[]) {
		this.config = config
		this.names = names ?? []
	}

	/** 获取全局单例（未初始化时使用默认配置自动创建） */
	static getInstance(): LogUtil {
		if (!LogUtil.instance) {
			LogUtil.initialize()
		}
		return LogUtil.instance!
	}

	/** 初始化全局单例配置（应用启动时调用一次） */
	static initialize(config?: LogConfig): void {
		const logDir = config?.logDir ?? process.env.AGENT_ENGINE_LOG_DIR
		const resolved: ResolvedConfig = {
			level: config?.level ?? 'info',
			includeCallSite: config?.includeCallSite ?? true,
			formatter: config?.formatter ?? new StandardLogFormatter(),
			provider: config?.provider ?? new ConsoleLogProvider(),
			store: config?.store ?? (logDir ? new FileLogStore({logDir}) : null),
		}
		LogUtil.instance = new LogUtil(resolved)
	}

	/** 静态快捷方法，免去 getInstance() 调用 */
	static debug(msg: string, attrs?: Record<string, unknown>): void {
		LogUtil.getInstance().debug(msg, attrs)
	}

	static info(msg: string, attrs?: Record<string, unknown>): void {
		LogUtil.getInstance().info(msg, attrs)
	}

	static warn(msg: string, attrs?: Record<string, unknown>): void {
		LogUtil.getInstance().warn(msg, attrs)
	}

	static error(msg: string, attrs?: Record<string, unknown>): void {
		LogUtil.getInstance().error(msg, attrs)
	}

	/** 原样输出（不经过格式化和持久化），用于 CLI 用户界面展示 */
	static print(msg: string): void {
		LogUtil.getInstance().print(msg)
	}

	/**
	 * 设置全局日志级别
	 * @param level 新的日志级别
	 */
	static setLevel(level: LogLevel): void {
		const instance = LogUtil.getInstance()
		instance.config.level = level
	}

	/** 优雅关闭：刷新缓冲区，释放资源 */
	static async shutdown(): Promise<void> {
		if (!LogUtil.instance) return
		const inst = LogUtil.instance
		LogUtil.instance = null

		if (inst.config.store) {
			await inst.config.store.dispose()
		}
		if (inst.config.provider.dispose) {
			inst.config.provider.dispose()
		}
	}

	debug(msg: string, attrs?: Record<string, unknown>): void {
		this.log('debug', msg, attrs)
	}

	info(msg: string, attrs?: Record<string, unknown>): void {
		this.log('info', msg, attrs)
	}

	warn(msg: string, attrs?: Record<string, unknown>): void {
		this.log('warn', msg, attrs)
	}

	error(msg: string, attrs?: Record<string, unknown>): void {
		this.log('error', msg, attrs)
	}

	/** 创建子 logger，继承配置，loggerName 用 : 连接 */
	child(name: string): LogUtil {
		return new LogUtil(this.config, [...this.names, name])
	}

	/** 原样输出（不经过格式化和持久化），用于 CLI 用户界面展示 */
	print(msg: string): void {
		this.config.provider.print(msg)
	}

	/** 内部统一日志处理流程 */
	private log(level: LogLevel, msg: string, attrs?: Record<string, unknown>): void {
		// 1. 级别检查
		if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.config.level]) {
			return
		}

		// 2. 捕获调用位置（如果启用）
		const callSite = this.config.includeCallSite ? captureCallSite() : undefined

		// 3. 从 MDC 获取上下文并合并到 attrs
		const mdcContext = MDC.getContext()
		const mergedAttrs = {...mdcContext, ...attrs}

		// 4. 构建 LogRecord
		const record: LogRecord = {
			level,
			timestamp: new Date(),
			message: msg,
			callSite,
			attrs: Object.keys(mergedAttrs).length > 0 ? mergedAttrs : undefined,
			loggerName: this.names.length > 0 ? this.names.join(':') : undefined,
		}

		// 5. 格式化
		const formatted = this.config.formatter.format(record)

		// 6. 输出到终端
		this.config.provider.write(formatted, level)

		// 7. 持久化（异步，不阻塞）
		if (this.config.store) {
			this.config.store.append(record)
		}
	}
}
