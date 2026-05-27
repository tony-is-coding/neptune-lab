import type { User } from '../stores/auth';
import { API_BASE, getJsonHeaders } from './client';

/** 后端登录/注册接口实际返回的结构 */
interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** 将后端 AuthResponse 转换为前端 store 需要的格式 */
function mapResponse(data: AuthResponse): { token: string; user: User } {
  return { token: data.accessToken, user: data.user };
}

export async function login(email: string, password: string): Promise<{ token: string; user: User }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Login failed: ${res.status}`);
  }
  const data: AuthResponse = await res.json();
  return mapResponse(data);
}

export async function register(name: string, email: string, password: string): Promise<{ token: string; user: User }> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, tenantName: 'Default' }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Register failed: ${res.status}`);
  }
  const data: AuthResponse = await res.json();
  return mapResponse(data);
}
