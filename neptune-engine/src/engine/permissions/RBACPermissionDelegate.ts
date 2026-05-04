import type { PermissionDecision } from './PermissionDecision.js'
import type { PermissionDelegate } from './PermissionDelegate.js'

/**
 * 工具权限规则
 * - allow: 允许访问的工具列表
 * - deny: 拒绝访问的工具列表
 * 优先级：deny > allow
 */
export interface ToolPermissionRule {
  /** 允许的工具列表（通配符 * 表示所有工具） */
  allow?: string[]
  /** 拒绝的工具列表（优先级高于 allow） */
  deny?: string[]
}

/**
 * 角色权限映射
 * key: 角色名称（如 'admin', 'user', 'readonly'）
 * value: 该角色的工具权限规则
 */
export type RolePermissionMap = Record<string, ToolPermissionRule>

/**
 * RBACPermissionDelegate — 基于角色的访问控制权限委托
 *
 * 根据用户角色决定工具访问权限。
 * 支持通配符匹配（如 'File*' 匹配所有 File 开头的工具）。
 *
 * 使用示例：
 * ```ts
 * const roleMap = {
 *   admin: { allow: ['*'] }, // 所有权限
 *   user: { allow: ['Read', 'Write', 'Bash'], deny: ['Delete'] },
 *   readonly: { allow: ['Read', 'Grep', 'Glob'] },
 * }
 * const delegate = new RBACPermissionDelegate(roleMap, 'user')
 * ```
 */
export class RBACPermissionDelegate implements PermissionDelegate {
  private readonly roleMap: RolePermissionMap
  private _currentRole: string

  constructor(roleMap: RolePermissionMap, currentRole: string) {
    this.roleMap = roleMap
    this._currentRole = currentRole
  }

  async onToolAccess(toolName: string, _input: Record<string, unknown>): Promise<PermissionDecision> {
    const rule = this.roleMap[this._currentRole]

    // 如果角色不存在，默认 ask（回退到交互式确认）
    if (!rule) {
      return 'ask'
    }

    // 检查 deny 列表（优先级最高）
    if (rule.deny && this.matchTool(toolName, rule.deny)) {
      return 'deny'
    }

    // 检查 allow 列表
    if (rule.allow && this.matchTool(toolName, rule.allow)) {
      return 'allow'
    }

    // 默认 ask（回退到交互式确认）
    return 'ask'
  }

  /**
   * 检查工具名是否匹配规则列表
   * 支持精确匹配和通配符匹配
   */
  private matchTool(toolName: string, patterns: string[]): boolean {
    return patterns.some(pattern => {
      if (pattern === '*') {
        return true
      }
      if (pattern.endsWith('*')) {
        const prefix = pattern.slice(0, -1)
        return toolName.startsWith(prefix)
      }
      return toolName === pattern
    })
  }

  /**
   * 切换当前角色
   */
  setRole(role: string): void {
    this._currentRole = role
  }

  /**
   * 获取当前角色
   */
  getRole(): string {
    return this._currentRole
  }
}
