import type {ApiErrorCode} from './errors';

export type IsoDateString = string;

export interface PaginationMeta {
  count: number;
  limit: number;
  offset: number;
  include?: string;
}

/**
 * 跨层错误响应统一信封。
 *
 * - error 必须是 ApiErrorCode 枚举值，不接受自由字符串
 * - message 必须是中文用户可读说明
 * - requestId 由 onRequest hook 注入，错误响应必须携带便于追溯
 * - details 用于结构化补充信息（例如 STATE_CONFLICT 的 reason、字段校验错误清单）
 */
export interface ApiErrorEnvelope {
  error: ApiErrorCode;
  message: string;
  requestId?: string;
  details?: Record<string, unknown>;
}

export interface ListResponse<T> {
  data: T[];
  meta: PaginationMeta;
}
