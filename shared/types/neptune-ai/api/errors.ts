/**
 * 标准错误码字典
 *
 * 设计原则：
 * - 错误码集合是封闭的：所有新增错误必须扩充该枚举
 * - 错误码与 HTTP status 解耦但有典型映射（见 ApiErrorStatusMap）
 * - 业务子状态通过 details.reason 字段携带，不扩张顶层错误码
 * - 客户端只允许对该枚举里的值进行分支判断，不允许字符串模糊匹配
 *
 * 任何对该枚举的修改都属于跨层 API 变更，必须同步：
 * - shared 类型导出
 * - neptune-ai/server 路由实现
 * - neptune-ai/web 客户端处理
 * - 错误信封一致性合同测试
 * - docs/governance/api-error-envelope.md（如有）
 */
export const API_ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'RESOURCE_NOT_FOUND',
  'STATE_CONFLICT',
  'QUOTA_EXCEEDED',
  'INTERNAL_ERROR',
] as const;

export type ApiErrorCode = typeof API_ERROR_CODES[number];

/**
 * 错误码到 HTTP 状态码的典型映射。
 * 路由可以在特殊场景下使用其它 status，但必须有充分理由。
 */
export const API_ERROR_STATUS: Record<ApiErrorCode, number> = {
  VALIDATION_FAILED: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  RESOURCE_NOT_FOUND: 404,
  STATE_CONFLICT: 409,
  QUOTA_EXCEEDED: 429,
  INTERNAL_ERROR: 500,
};

/**
 * details.reason 在 STATE_CONFLICT 下的子原因枚举，便于前端无字符串匹配地分支。
 * 新增子状态在这里登记，再在路由里引用。
 */
export const API_STATE_CONFLICT_REASONS = [
  'review_already_decided',
  'close_report_not_ready',
  'skill_not_published',
  'period_not_open',
  'run_not_running',
  'run_already_completed',
  'workspace_locked',
] as const;

export type ApiStateConflictReason = typeof API_STATE_CONFLICT_REASONS[number];

/**
 * 类型守卫：判断字符串是否为合法的标准错误码。
 * 客户端在做 error code 分支判断时应优先使用。
 */
export function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return typeof value === 'string' && (API_ERROR_CODES as readonly string[]).includes(value);
}
