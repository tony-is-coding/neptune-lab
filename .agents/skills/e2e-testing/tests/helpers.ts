/**
 * E2E 测试公共工具
 *
 * 提供登录、API 调用、诊断收集等通用功能。
 * 所有测试文件应引用此文件的工具函数。
 */
import type { Page } from '@playwright/test';

/** 前端 dev server 地址 */
export const DEV_URL = 'http://localhost:3004';
/** 后端 API 地址 */
export const API_URL = 'http://localhost:3000/api/v1';

/** 默认管理员账号（由 server ensureDefaultAdmin 创建） */
export const ADMIN_USER = {
  email: 'admin@neptune.ai',
  password: 'admin',
};

/**
 * 通过 API 登录并设置 localStorage auth state
 *
 * 跳过 UI 登录流程，直接设置 token 到 localStorage。
 * 在 test.beforeEach 中调用。
 */
export async function loginViaApi(page: Page, user = ADMIN_USER): Promise<{ token: string; userId: string }> {
  const response = await page.request.post(`${API_URL}/auth/login`, {
    data: { email: user.email, password: user.password },
  });

  if (!response.ok()) {
    throw new Error(`Login failed: ${response.status()} ${await response.text()}`);
  }

  const data = await response.json();
  const token = data.accessToken;
  const userData = data.user;

  // 先访问页面以设置 localStorage
  await page.goto(DEV_URL);
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('neptune-auth', JSON.stringify({
      state: {
        token,
        user,
        isAuthenticated: true,
      },
      version: 0,
    }));
  }, { token, user: userData });

  return { token, userId: userData.id };
}

/**
 * 通过 API 创建 Agent 模板
 *
 * 返回创建的 agent 对象。
 */
export async function createAgentViaApi(page: Page, token: string, agent: {
  name: string;
  description?: string;
  systemPrompt?: string;
}): Promise<{ id: string; name: string }> {
  const response = await page.request.post(`${API_URL}/agents`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      name: agent.name,
      description: agent.description || 'Test agent',
      icon: 'smart_toy',
      systemPrompt: agent.systemPrompt || 'You are a helpful assistant.',
      modelConfig: {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        temperature: 0.7,
        maxTokens: 4096,
      },
      tools: [],
      skills: [],
      mcpServers: [],
    },
  });

  if (!response.ok()) {
    throw new Error(`Create agent failed: ${response.status()}`);
  }

  return await response.json();
}

/**
 * 通过 API 创建 Thread
 */
export async function createThreadViaApi(page: Page, token: string, agentId: string, title?: string): Promise<{ id: string }> {
  const response = await page.request.post(`${API_URL}/agents/${agentId}/threads`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { title: title || 'Test Thread' },
  });

  if (!response.ok()) {
    throw new Error(`Create thread failed: ${response.status()}`);
  }

  return await response.json();
}

/**
 * 诊断收集器 — 收集 console 日志、网络请求、页面错误
 */
export interface Diagnostics {
  logs: string[];
  requests: string[];
  errors: string[];
}

export function attachDiagnostics(page: Page): Diagnostics {
  const diag: Diagnostics = { logs: [], requests: [], errors: [] };

  page.on('console', (msg) => {
    diag.logs.push(`[${msg.type()}] ${msg.text()}`);
  });

  page.on('request', (req) => {
    if (req.url().includes('/api/')) {
      diag.requests.push(`>> ${req.method()} ${req.url()}`);
    }
  });

  page.on('response', (res) => {
    if (res.url().includes('/api/')) {
      diag.requests.push(`<< ${res.status()} ${res.url()}`);
    }
  });

  page.on('pageerror', (err) => {
    diag.errors.push(err.message);
  });

  return diag;
}

/**
 * 断言无页面错误（排除已知的无害错误）
 */
export function assertNoErrors(diag: Diagnostics, knownPatterns: string[] = []) {
  const realErrors = diag.errors.filter(err =>
    !knownPatterns.some(pattern => err.includes(pattern)),
  );
  if (realErrors.length > 0) {
    throw new Error(`Unexpected page errors:\n${realErrors.join('\n')}`);
  }
}
