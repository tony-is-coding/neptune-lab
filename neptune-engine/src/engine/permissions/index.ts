/**
 * permissions 模块 — 统一导出
 *
 * 权限委托接口和内置实现：
 * - PermissionDelegate：可编程的权限决策接口
 * - PermissionDecision：权限决策结果类型
 * - ReadOnlyPermissionDelegate：只读策略
 * - RBACPermissionDelegate：基于角色的访问控制
 * - AuditPermissionDelegate：审计日志装饰器
 */

export type {PermissionDecision} from './PermissionDecision.js'
export type {PermissionDelegate} from './PermissionDelegate.js'
export {ReadOnlyPermissionDelegate} from './ReadOnlyPermissionDelegate.js'
export {RBACPermissionDelegate} from './RBACPermissionDelegate.js'
export type {RolePermissionMap, ToolPermissionRule} from './RBACPermissionDelegate.js'
export {AuditPermissionDelegate} from './AuditPermissionDelegate.js'
