/**
 * engine/context/ 公共 API 导出
 *
 * 上下文卸载机制，用于管理工具输出在上下文窗口中的大小。
 *
 * @internal 预留接口，待上下文卸载集成后使用
 */

// 接口和类型
export type { OffloadStrategy, OffloadResult } from './OffloadStrategy.js'

// 默认实现
export { DefaultOffloadStrategy } from './DefaultOffloadStrategy.js'
