import type {PermissionDecision} from './PermissionDecision.js'

/**
 * PermissionDelegate — 可编程的权限决策接口
 *
 * SDK 使用者可注入自定义权限策略，替代仅有的 bypass/交互式 两种极端模式。
 * 当 delegate 返回 'allow' 时直接放行，'deny' 时直接拒绝，
 * 'ask' 时回退到 CC 原始权限检查（交互式对话框）。
 */
export interface PermissionDelegate {
	/** 工具访问权限决策 */
	onToolAccess(toolName: string, input: Record<string, unknown>): Promise<PermissionDecision>
}
