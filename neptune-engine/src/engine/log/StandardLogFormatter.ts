/**
 * StandardLogFormatter — LogFormatter 的默认实现
 *
 * 输出格式：{LEVEL} {TIME} [{FILE:LINE}] <loggerName> {MSG}; {key=value params}
 *
 * - LEVEL 大写，右补齐 5 字符
 * - TIME 使用 ISO 格式
 * - 如果有 loggerName，在文件位置后显示 <name>
 * - 如果没有 callSite，省略 [file:line] 部分
 */

import type {LogFormatter} from './LogFormatter'
import type {LogRecord} from './LogRecord'

export class StandardLogFormatter implements LogFormatter {
	/** 将 LogRecord 格式化为输出字符串 */
	format(record: LogRecord): string {
		const level = record.level.toUpperCase().padEnd(5)
		const time = record.timestamp.toISOString()
		const site = record.callSite
			? ` [${record.callSite.file}:${record.callSite.line}]`
			: ''
		const name = record.loggerName ? ` <${record.loggerName}>` : ''
		const attrs = record.attrs
			? '; ' + Object.entries(record.attrs)
			.map(([k, v]) => `${k}=${v}`)
			.join(' ')
			: ''
		return `${level} ${time}${site}${name} ${record.message}${attrs}`
	}
}
