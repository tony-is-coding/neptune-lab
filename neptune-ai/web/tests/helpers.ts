/**
 * E2E 测试通用诊断工具
 * 收集 console 日志、网络请求、页面错误、localStorage 状态
 */
import type { Page } from '@playwright/test';

export interface Diagnostics {
  logs: string[];
  requests: string[];
  errors: string[];
}

/**
 * 在 page 上挂载诊断收集器
 */
export function attachDiagnostics(page: Page): Diagnostics {
  const diag: Diagnostics = { logs: [], requests: [], errors: [] };

  page.on('console', (msg) => {
    diag.logs.push(`[${msg.type()}] ${msg.text()}`);
  });

  page.on('request', (req) => {
    if (req.url().includes(':3000') || req.url().includes(':1420/api') || req.url().includes(':3004/api')) {
      diag.requests.push(`>> ${req.method()} ${req.url()}`);
    }
  });

  page.on('response', (res) => {
    if (res.url().includes(':3000') || res.url().includes(':1420/api') || res.url().includes(':3004/api')) {
      diag.requests.push(`<< ${res.status()} ${res.url()}`);
    }
  });

  page.on('pageerror', (err) => {
    diag.errors.push(err.message);
  });

  return diag;
}

/**
 * 输出诊断报告
 */
export function printReport(diag: Diagnostics, finalUrl: string, stored: string | null) {
  console.log('\n========== E2E DIAGNOSTICS ==========\n');
  console.log('Final URL:', finalUrl);

  console.log('\n--- API Requests ---');
  diag.requests.forEach(r => console.log(r));

  console.log('\n--- Console Logs (non-debug) ---');
  diag.logs.filter(l => !l.startsWith('[debug]')).forEach(l => console.log(l));

  console.log('\n--- Page Errors ---');
  if (diag.errors.length > 0) {
    diag.errors.forEach(e => console.log('ERROR:', e));
  } else {
    console.log('(none)');
  }

  console.log('\n--- localStorage ---');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      console.log('hasToken:', !!parsed?.state?.token);
      console.log('hasUser:', !!parsed?.state?.user);
      console.log('isAuthenticated:', parsed?.state?.isAuthenticated);
    } catch {
      console.log('Parse error:', stored.slice(0, 100));
    }
  } else {
    console.log('neptune-auth: EMPTY');
  }
}

/**
 * 测试配置常量
 */
export const DEV_URL = 'http://localhost:1420';
export const API_URL = 'http://localhost:3002/api/v1';
export const TEST_USER = {
  email: 'terrence@neptune.ai',
  password: 'Neptune2024!',
  name: 'Terrence',
};

/**
 * 通过 API 登录获取 token
 */
export async function loginViaApi(page: Page): Promise<void> {
  // 使用测试用户登录
  const response = await page.request.post(`${API_URL}/auth/login`, {
    data: {
      email: 'test@neptune.ai',
      password: 'Test1234!',
    },
  });

  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`Login API failed: ${response.status()} - ${body}`);
  }

  const data = await response.json();
  const token = data.accessToken || data.token;
  const user = data.user;

  if (!token) {
    throw new Error(`Login succeeded but no token in response: ${JSON.stringify(Object.keys(data))}`);
  }

  // 导航到 Playwright baseURL (localhost:3004) 确保 localStorage 在正确的 origin 下设置
  await page.goto('/login');

  // 设置 localStorage
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('neptune-auth', JSON.stringify({
      state: {
        token: token,
        user: user,
        isAuthenticated: true,
      },
      version: 0,
    }));
  }, { token, user });

  // 验证设置成功
  const stored = await page.evaluate(() => localStorage.getItem('neptune-auth'));
  if (!stored) {
    throw new Error('Failed to set auth in localStorage');
  }
}
