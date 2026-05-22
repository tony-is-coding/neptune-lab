/**
 * engine/types/query-engine.ts
 *
 * QueryEngine 类型屏障文件
 *
 * 重新导出 src/QueryEngine.ts 的核心类型，避免 engine/ 向外穿透到 src/。
 *
 * @module
 */

// 重新导出 QueryEngine 类型
export type {QueryEngineConfig} from '@neptune/engine-product/QueryEngine.js'
export {QueryEngine} from '@neptune/engine-product/QueryEngine.js'
