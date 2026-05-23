import { getStoredToken, useAuthStore } from '../stores/auth';
import type { ApiErrorCode, ApiErrorEnvelope } from '@shared/neptune-ai';
import { isApiErrorCode } from '@shared/neptune-ai';

export const API_BASE = '/api/v1';

// Re-export for hook consumers (例如 useRunEventStream 需要在 fetch 时
// 自行设置 Authorization 头)
export { getStoredToken };

export class ApiClientError extends Error {
  readonly status: number;
  readonly error: ApiErrorCode;
  readonly requestId: string;
  readonly details: Record<string, unknown>;
  readonly envelope: Required<ApiErrorEnvelope>;

  constructor(status: number, envelope: ApiErrorEnvelope) {
    const normalized = normalizeApiErrorEnvelope(envelope);
    super(normalized.message);
    this.name = 'ApiClientError';
    this.status = status;
    this.error = normalized.error;
    this.requestId = normalized.requestId;
    this.details = normalized.details;
    this.envelope = normalized;
  }
}

export function normalizeApiErrorEnvelope(envelope: ApiErrorEnvelope): Required<ApiErrorEnvelope> {
  return {
    error: isApiErrorCode(envelope.error) ? envelope.error : 'INTERNAL_ERROR',
    message: envelope.message || '请求失败',
    requestId: envelope.requestId || '',
    details: envelope.details || {},
  };
}

export async function readApiErrorEnvelope(
  response: Response,
  fallback?: Partial<ApiErrorEnvelope>,
): Promise<Required<ApiErrorEnvelope>> {
  let payload: Partial<ApiErrorEnvelope> = {};
  try {
    const parsed = await response.json();
    if (parsed && typeof parsed === 'object') {
      payload = parsed as Partial<ApiErrorEnvelope>;
    }
  } catch {
    payload = {};
  }

  // 如果服务端返回了非枚举内的错误码（旧接口或上游异常），统一回退到 INTERNAL_ERROR
  // 以保证客户端分支判断的封闭性。
  const fallbackCode: ApiErrorCode = isApiErrorCode(fallback?.error) ? fallback!.error : 'INTERNAL_ERROR';

  return normalizeApiErrorEnvelope({
    error: isApiErrorCode(payload.error) ? payload.error : fallbackCode,
    message: typeof payload.message === 'string' ? payload.message : fallback?.message || `请求失败：${response.status}`,
    requestId: typeof payload.requestId === 'string'
      ? payload.requestId
      : response.headers.get('x-request-id') || fallback?.requestId || '',
    details: payload.details && typeof payload.details === 'object'
      ? payload.details as Record<string, unknown>
      : fallback?.details || {},
  });
}

export async function throwApiClientError(
  response: Response,
  fallback?: Partial<ApiErrorEnvelope>,
): Promise<never> {
  const envelope = await readApiErrorEnvelope(response, fallback);
  throw new ApiClientError(response.status, envelope);
}

export function formatApiErrorForDisplay(error: unknown, fallback = '未知错误'): string {
  if (error instanceof ApiClientError) {
    return [
      error.message,
      error.requestId ? `请求编号：${error.requestId}` : '',
    ].filter(Boolean).join('\n');
  }

  if (error instanceof Error) return error.message;
  return fallback;
}

export function getAuthHeaders(): Record<string, string> {
  const token = getStoredToken();
  if (!token || token === 'undefined') return {};
  return { Authorization: `Bearer ${token}` }
}

export function getJsonHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json', ...getAuthHeaders() }
}

/**
 * 处理 API 响应：401 时自动清除认证并跳转登录页
 */
export function handleUnauthorized(response: Response): void {
  if (response.status === 401) {
    useAuthStore.getState().clearAuth();
    window.location.href = '/login';
  }
}

/**
 * 带超时配置的 fetch 工具函数
 * @param url - 请求 URL
 * @param options - fetch 请求配置
 * @param timeout - 超时时间（毫秒），默认 10000ms（10秒）
 * @returns Promise<Response>
 * @throws 超时时抛出 'Request timeout' 错误
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = 10000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
}
