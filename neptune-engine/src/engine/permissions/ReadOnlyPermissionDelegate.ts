import type { PermissionDecision } from './PermissionDecision.js'
import type { PermissionDelegate } from './PermissionDelegate.js'

/**
 * ReadOnlyPermissionDelegate — 内置只读策略
 *
 * 只读工具自动放行，写操作自动拒绝。
 * 适用于只读分析、代码审查等不希望修改文件系统的场景。
 */
const READ_ONLY_TOOLS = ['Read', 'Grep', 'Glob', 'WebSearch', 'WebFetch', 'Agent']

export class ReadOnlyPermissionDelegate implements PermissionDelegate {
  async onToolAccess(toolName: string, _input: Record<string, unknown>): Promise<PermissionDecision> {
    return READ_ONLY_TOOLS.includes(toolName) ? 'allow' : 'deny'
  }
}
