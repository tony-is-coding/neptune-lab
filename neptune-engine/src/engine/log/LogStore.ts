/**
 * LogStore — 日志持久化存储接口
 *
 * 负责将结构化的 LogRecord 持久化到存储后端（文件、远程服务、数据库等）。
 * 用户可实现此接口自定义存储策略。
 */

import type { LogRecord } from './LogRecord'

/** 日志持久化存储 */
export interface LogStore {
  /** 追加一条日志记录（异步，不阻塞主流程） */
  append(record: LogRecord): void
  /** 刷新缓冲区，确保所有日志写入完成 */
  flush(): Promise<void>
  /** 释放资源，关闭前应先 flush */
  dispose(): Promise<void>
}
