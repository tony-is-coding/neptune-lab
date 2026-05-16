/**
 * ConsoleLogProvider — LogProvider 的默认实现
 *
 * 将格式化后的日志字符串通过 console[level] 输出到终端。
 */

import type {LogLevel} from './LogRecord'
import type {LogProvider} from './LogProvider'

export class ConsoleLogProvider implements LogProvider {
	/** 输出一条格式化后的日志到终端 */
	write(formattedMessage: string, level: LogLevel): void {
		console[level](formattedMessage)
	}

	/** 原样输出到终端（不经过格式化），用于 CLI 用户界面展示 */
	print(message: string): void {
		console.log(message)
	}

	/** 释放资源（Console 无需清理） */
	dispose(): void {
		// no-op
	}
}
