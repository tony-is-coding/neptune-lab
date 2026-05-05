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
