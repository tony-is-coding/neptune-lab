/**
 * log 模块 — 统一导出
 *
 * 全局日志体系的核心接口与默认实现，包含：
 * - LogRecord：日志级别、调用位置、结构化记录、配置
 * - LogFormatter / StandardLogFormatter / JsonLogFormatter：格式化策略
 * - LogProvider / ConsoleLogProvider：输出通道
 * - LogStore / FileLogStore：持久化存储
 * - LogUtil：全局日志入口（单例）
 * - MDC：映射诊断上下文（支持 sessionId、requestId 自动注入）
 * - captureCallSite：调用位置捕获工具
 */

export type { LogLevel, CallSite, LogRecord, LogConfig } from './LogRecord'
export type { EngineLogger } from './EngineLogger'
export type { LogFormatter } from './LogFormatter'
export type { LogProvider } from './LogProvider'
export type { LogStore } from './LogStore'

export { StandardLogFormatter } from './StandardLogFormatter'
export { JsonLogFormatter } from './JsonLogFormatter'
export { ConsoleLogProvider } from './ConsoleLogProvider'
export { FileLogStore } from './FileLogStore'
export type { FileLogStoreOptions } from './FileLogStore'
export { MDC } from './MDC'
export type { MDCContext } from './MDC'
export { captureCallSite } from './callsite'
export { LogUtil } from './LogUtil'
