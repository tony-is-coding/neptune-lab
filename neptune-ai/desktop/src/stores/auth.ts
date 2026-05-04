import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';

/**
 * 认证状态
 */
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
}

/**
 * 认证 store
 * 使用 zustand persist 中间件自动同步到 localStorage
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user, token) => {
        console.log('[Auth] setAuth called:', { user, token: token ? `${token.slice(0, 20)}...` : 'null' });
        set({ user, token, isAuthenticated: true });
        // 验证 persist 是否生效
        requestAnimationFrame(() => {
          const stored = localStorage.getItem('neptune-auth');
          console.log('[Auth] Persisted to localStorage:', stored ? 'OK' : 'FAILED');
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              console.log('[Auth] Stored state:', {
                hasToken: !!parsed?.state?.token,
                hasUser: !!parsed?.state?.user,
                isAuthenticated: parsed?.state?.isAuthenticated,
              });
            } catch {}
          }
        });
      },
      clearAuth: () => {
        console.log('[Auth] clearAuth called');
        set({ user: null, token: null, isAuthenticated: false });
      },
    }),
    {
      name: 'neptune-auth',
    }
  )
);

/**
 * 获取保存的 token（供 axios 拦截器使用）
 * zustand persist 存储结构: { state: { token, user, ... }, version: 0 }
 */
export function getStoredToken(): string | null {
  try {
    const raw = localStorage.getItem('neptune-auth');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.token || null;
  } catch {
    return null;
  }
}

/**
 * 获取保存的用户（供初始化使用）
 * zustand persist 存储结构: { state: { token, user, ... }, version: 0 }
 */
export function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem('neptune-auth');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.user || null;
  } catch {
    return null;
  }
}
