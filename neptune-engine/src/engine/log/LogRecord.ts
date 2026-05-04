/**
 * LogRecord — 日志系统核心类型定义
 *
 * 定义日志级别、调用位置、结构化日志记录和日志配置。
 * LogLevel 复用 observability 模块的定义，保持一致性。
 */

import type { LogLevel } from './EngineLogger'
import type { LogFormatter } from './LogFormatter'
import type { LogProvider } from './LogProvider'
import type { LogStore } from './LogStore'

/** 重新导出 LogLevel，方便外部统一从 log/ 模块引入 */
export type { LogLevel } from './EngineLogger'

/** 重新导出日志相关类型，方便外部统一从 log/ 模块引入 */
export type { LogFormatter } from './LogFormatter'
export type { LogProvider } from './LogProvider'
export type { LogStore } from './LogStore'

/** 调用位置信息 */
export interface CallSite {
  /** 相对路径，如 "src/server/server.ts" */
  file: string
  /** 行号 */
  line: number
}

/** 结构化日志记录 */
export interface LogRecord {
  /** 日志级别 */
  level: LogLevel
  /** 日志产生时间 */
  timestamp: Date
  /** 调用位置（文件+行号），可选 */
  callSite?: CallSite
  /** 日志消息 */
  message: string
  /** 结构化属性，可选 */
  attrs?: Record<string, unknown>
  /** 子 logger 名称链，如 "engine:session"，可选 */
  loggerName?: string
}

/** 日志系统配置 */
export interface LogConfig {
  /** 最低日志级别，默认 'info' */
  level?: LogLevel
  /** 是否捕获调用位置（文件+行号），默认 true */
  includeCallSite?: boolean
  /** 自定义格式化器 */
  formatter?: LogFormatter
  /** 自定义输出通道 */
  provider?: LogProvider
  /** 自定义持久化存储 */
  store?: LogStore
  /** 日志文件根目录，默认读取环境变量 AGENT_ENGINE_LOG_DIR */
  logDir?: string
}
