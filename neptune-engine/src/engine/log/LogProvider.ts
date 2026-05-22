/**
 * LogProvider — 日志输出通道接口
 *
 * 负责将格式化后的日志字符串输出到目标通道（如终端）。
 * 用户可实现此接口自定义输出方式。
 */

import type {LogLevel} from './LogRecord'

/** 日志输出通道 */
export interface LogProvider {
	/** 输出一条格式化后的日志 */
	write(formattedMessage: string, level: LogLevel): void

	/** 原样输出（不经过格式化），用于 CLI 用户界面展示 */
	print(message: string): void

	/** 释放资源（可选） */
	dispose?(): void
}
