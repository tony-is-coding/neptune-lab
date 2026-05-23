/**
 * Neptune-AI 统一日志模块
 *
 * 基于 Engine 的 LogUtil（@neptune/engine），提供：
 * - initLogger()：应用启动时初始化 LogUtil
 * - createLogger(module)：服务层获取带模块名的 child logger
 *
 * LogUtil 特性：
 * - 结构化日志（level + timestamp + callSite + attrs）
 * - MDC 上下文自动注入（sessionId、requestId、tenantId）
 * - child(name) 子 logger 链式命名
 * - StandardLogFormatter 单行输出
 */

import {LogUtil, MDC} from '@neptune/engine';
import type {LogLevel} from '@neptune/engine';

/**
 * 初始化全局日志（应用启动时调用一次）
 */
export function initLogger(level?: LogLevel): void {
    LogUtil.initialize({
        level: (level || process.env.LOG_LEVEL || 'info') as LogLevel,
        includeCallSite: false,
    });
}

/**
 * 获取带模块名的 child logger
 *
 * 服务层使用：
 *   const log = createLogger('thread-manager');
 *   log.info('dispatch started', { threadId });
 *
 * 支持进一步派生：
 *   const reqLog = log.child('dispatch');
 */
export function createLogger(module: string): LogUtil {
    return LogUtil.getInstance().child(module);
}

export {LogUtil, MDC};
export type {LogLevel};
