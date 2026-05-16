/**
 * engine/hooks — Hook 系统核心模块
 *
 * 提供零 UI 依赖的 Hook 执行能力。
 * 用于 headless/SDK/server 模式。
 */
export {createHookCore, buildBaseHookInput} from './HookCore.js'
export type {HookContext, HookResult, HookExecutor} from './HookContext.js'
