/**
 * LogFormatter — 日志格式化策略接口
 *
 * 负责将结构化的 LogRecord 格式化为输出字符串。
 * 用户可实现此接口替换默认格式化策略。
 */

import type { LogRecord } from './LogRecord'

/** 日志格式化策略 */
export interface LogFormatter {
  /** 将 LogRecord 格式化为输出字符串 */
  format(record: LogRecord): string
}
