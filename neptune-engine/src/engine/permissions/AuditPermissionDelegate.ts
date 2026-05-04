import type { PermissionDecision } from './PermissionDecision.js'
import type { PermissionDelegate } from './PermissionDelegate.js'
import { LogUtil } from '../log/index.js'

/**
 * AuditPermissionDelegate — 审计日志装饰器
 *
 * 包装另一个 PermissionDelegate，记录所有权限决策到日志。
 * 使用 child logger 确保日志分类为 "engine:permissions:audit"。
 *
 * 使用示例：
 * ```ts
 * const baseDelegate = new RBACPermissionDelegate(roleMap, 'user')
 * const auditDelegate = new AuditPermissionDelegate(baseDelegate)
 * // 所有权限决策都会被记录
 * ```
 */
export class AuditPermissionDelegate implements PermissionDelegate {
  private readonly baseDelegate: PermissionDelegate
  private readonly logger: LogUtil

  constructor(baseDelegate: PermissionDelegate) {
    this.baseDelegate = baseDelegate
    this.logger = LogUtil.getInstance().child('permissions').child('audit')
  }

  async onToolAccess(toolName: string, input: Record<string, unknown>): Promise<PermissionDecision> {
    const startTime = Date.now()

    // 调用基础委托获取决策
    const decision = await this.baseDelegate.onToolAccess(toolName, input)

    const duration = Date.now() - startTime

    // 记录审计日志
    this.logger.info('Permission decision', {
      toolName,
      decision,
      inputKeys: Object.keys(input),
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    })

    return decision
  }
}
