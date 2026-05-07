import { getStoredToken, useAuthStore } from '../stores/auth';

export const API_BASE = '/api/v1';

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
