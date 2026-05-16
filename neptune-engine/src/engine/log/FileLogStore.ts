/**
 * FileLogStore — LogStore 的默认实现
 *
 * 异步批量写入本地文件，特性：
 * - 按日期分割文件：agent-engine-YYYY-MM-DD.log
 * - 内部缓冲区 + 定时刷新（默认 1000ms）
 * - logDir 默认读取环境变量 AGENT_ENGINE_LOG_DIR，兜底 ~/.agent-engine/logs/
 * - 自动创建目录（如果不存在）
 * - dispose 时清理定时器并 flush 剩余数据
 */

import {mkdir, appendFile} from 'fs/promises'
import {join} from 'path'
import {homedir} from 'os'
import type {LogFormatter} from './LogFormatter'
import type {LogRecord} from './LogRecord'
import type {LogStore} from './LogStore'
import {StandardLogFormatter} from './StandardLogFormatter'

export interface FileLogStoreOptions {
	/** 日志文件根目录 */
	logDir?: string
	/** 自定义格式化器 */
	formatter?: LogFormatter
	/** 缓冲区刷新间隔（ms），默认 1000 */
	flushInterval?: number
}

/** 默认日志目录 */
function getDefaultLogDir(): string {
	return process.env.AGENT_ENGINE_LOG_DIR ?? join(homedir(), '.agent-engine', 'logs')
}

export class FileLogStore implements LogStore {
	private buffer: string[] = []
	private readonly formatter: LogFormatter
	private readonly logDir: string
	private flushTimer: ReturnType<typeof setInterval> | null = null
	private dirEnsured = false
	private flushing = false

	constructor(options?: FileLogStoreOptions) {
		this.logDir = options?.logDir ?? getDefaultLogDir()
		this.formatter = options?.formatter ?? new StandardLogFormatter()
		const interval = options?.flushInterval ?? 1000
		this.flushTimer = setInterval(() => {
			void this.flush()
		}, interval)
	}

	/** 追加一条日志记录到缓冲区 */
	append(record: LogRecord): void {
		const line = this.formatter.format(record)
		this.buffer.push(line)
	}

	/** 刷新缓冲区，将所有日志写入文件（含并发保护） */
	async flush(): Promise<void> {
		if (this.flushing || this.buffer.length === 0) return
		this.flushing = true
		try {
			const lines = this.buffer.splice(0)
			await this.ensureDir()
			const filePath = join(this.logDir, this.getLogFileName())
			await appendFile(filePath, lines.join('\n') + '\n', 'utf-8')
		} finally {
			this.flushing = false
		}
	}

	/** 释放资源：清理定时器并 flush 剩余数据 */
	async dispose(): Promise<void> {
		if (this.flushTimer) {
			clearInterval(this.flushTimer)
			this.flushTimer = null
		}
		await this.flush()
	}

	/** 确保日志目录存在 */
	private async ensureDir(): Promise<void> {
		if (this.dirEnsured) return
		await mkdir(this.logDir, {recursive: true})
		this.dirEnsured = true
	}

	/** 按日期分割日志文件：agent-engine-YYYY-MM-DD.log */
	private getLogFileName(): string {
		const date = new Date().toISOString().split('T')[0]
		return `agent-engine-${date}.log`
	}
}
