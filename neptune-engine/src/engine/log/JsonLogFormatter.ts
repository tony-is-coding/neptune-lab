/**
 * JsonLogFormatter — JSON 格式日志格式化器
 *
 * 输出格式：{"level":"INFO","timestamp":"2024-01-01T00:00:00.000Z","message":"...","loggerName":"...","callSite":{...},"attrs":{...}}
 *
 * 适用于：
 * - 日志聚合系统（ELK、Loki 等）
 * - 结构化日志分析
 * - 机器解析和监控
 */

import type { LogFormatter } from './LogFormatter'
import type { LogRecord } from './LogRecord'

export class JsonLogFormatter implements LogFormatter {
  /** 将 LogRecord 格式化为 JSON 字符串 */
  format(record: LogRecord): string {
    const jsonRecord: Record<string, unknown> = {
      level: record.level,
      timestamp: record.timestamp.toISOString(),
      message: record.message,
    }

    // 可选字段
    if (record.loggerName) {
      jsonRecord.loggerName = record.loggerName
    }

    if (record.callSite) {
      jsonRecord.callSite = {
        file: record.callSite.file,
        line: record.callSite.line,
      }
    }

    if (record.attrs && Object.keys(record.attrs).length > 0) {
      jsonRecord.attrs = record.attrs
    }

    return JSON.stringify(jsonRecord)
  }
}
