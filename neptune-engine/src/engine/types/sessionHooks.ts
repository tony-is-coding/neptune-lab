/**
 * engine/types/sessionHooks.ts
 *
 * SessionHooks 类型屏障文件
 *
 * 重新导出 src/utils/hooks/sessionHooks.ts 的核心类型，避免 engine/ 向外穿透到 src/utils/。
 *
 * @module
 */

// 重新导出 SessionHooks 相关类型
export type {
	SessionHooksState,
	SessionStore,
} from '../../utils/hooks/sessionHooks.js'

// 重新导出函数
export {addSessionHook} from '../../utils/hooks/sessionHooks.js'
