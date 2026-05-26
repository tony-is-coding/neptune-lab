/**
 * 策略决策（PolicyDecision）相关枚举与类型
 *
 * 设计原则（必须严守，否则事实层会被噪声污染）：
 *
 * 1. **policyType 集合是封闭的**。新增策略维度必须先扩展 POLICY_TYPES。
 *    客户端不允许对自由字符串做模糊匹配。
 *
 * 2. **PolicyDecision 只记录"治理事实"，不是"操作日志"**。
 *    什么算治理事实：
 *      - decision === 'deny'：必须记录
 *      - decision === 'review_required'：必须记录
 *      - decision === 'allow' + 高风险场景：可记录（例如人工豁免、跨边界数据访问允许）
 *      - decision === 'allow' + 普通通过：**不记录**，否则会噪声爆炸
 *
 * 3. **subjectType + subjectId 必须能在治理台聚合**。
 *    例：subjectType='tool', subjectId='Bash' 让治理方一眼看清「Bash 被多少次拒」。
 *
 * 4. **reason 必须中文用户可读**。给客户审计方/治理方看，不是给 server 工程师看。
 *
 * 5. **details 用于结构化补充信息，不存敏感字段**。
 *    server 端 PolicyDecisionService 内置 redactSummary 兜底，但调用方仍应自觉。
 */

/**
 * 策略类型（policyType）封闭枚举。
 *
 * 命名规则：snake_case，名词，描述决策维度而不是动作。
 * 修改本枚举属于跨层 API 变更，必须同步更新：
 *   - shared 类型导出
 *   - server PolicyDecision 写入点
 *   - 治理台 (web) 过滤器
 *   - 错误信封一致性合同测试
 *   - docs/governance/api-error-envelope.md 或独立 policy-decision.md
 */
export const POLICY_TYPES = [
  /** 工具白名单 / 黑名单决策（含 Agent 模板工具白名单 / 全局禁用工具）*/
  'tool',
  /** MCP server 白名单决策（租户级）*/
  'mcp_server',
  /** 文件路径白名单决策（限制在租户 workspace 内）*/
  'file_path',
  /** 配额硬门禁决策（每日 token 配额、并发会话上限）*/
  'quota',
  /** 模型选择决策（如禁用某 provider 或模型）*/
  'model',
  /** 角色 / RBAC 决策（如禁用某 role 访问某资源；当前 server 暂未启用）*/
  'role',
  /** 速率限制决策（per-tenant / per-user）*/
  'rate_limit',
] as const;

export type PolicyType = typeof POLICY_TYPES[number];

/**
 * 策略主体类型（subjectType）封闭枚举。
 *
 * 描述"决策针对的对象类别"。subjectId 是该类别下的具体标识。
 *
 * 例：policyType='tool', subjectType='tool', subjectId='Bash'
 *     policyType='mcp_server', subjectType='mcp_server', subjectId='filesystem-mcp'
 *     policyType='file_path', subjectType='file_path', subjectId='/etc/passwd'
 *     policyType='quota', subjectType='thread', subjectId='<thread-uuid>'
 *
 * 多数情况下 policyType 与 subjectType 一致，但故意保持两个独立维度，
 * 以便未来出现"针对 thread 做 tool 决策"等组合场景。
 */
export const POLICY_SUBJECT_TYPES = [
  'tool',
  'mcp_server',
  'file_path',
  'thread',
  'run',
  'agent',
  'model',
  'user',
] as const;

export type PolicySubjectType = typeof POLICY_SUBJECT_TYPES[number];

/**
 * 类型守卫：判断字符串是否为合法的 PolicyType。
 * 客户端在做 policyType 分支判断时应优先使用。
 */
export function isPolicyType(value: unknown): value is PolicyType {
  return typeof value === 'string' && (POLICY_TYPES as readonly string[]).includes(value);
}

/**
 * 类型守卫：判断字符串是否为合法的 PolicySubjectType。
 */
export function isPolicySubjectType(value: unknown): value is PolicySubjectType {
  return typeof value === 'string' && (POLICY_SUBJECT_TYPES as readonly string[]).includes(value);
}
