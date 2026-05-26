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
    if (isTrackedApiUrl(req.url())) {
      diag.requests.push(`>> ${req.method()} ${req.url()}`);
    }
  });

  page.on('response', (res) => {
    if (isTrackedApiUrl(res.url())) {
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

function isTrackedApiUrl(url: string): boolean {
  return url.includes(':3000/api/') || url.includes(':3004/api/');
}

/**
 * 测试配置常量
 */
export const WEB_URL = 'http://localhost:3004';
export const API_URL = 'http://localhost:3000/api/v1';
export const E2E_USER = {
  email: 'e2e@neptune.ai',
  password: 'NeptuneE2E2026!',
  name: 'Neptune E2E',
};
export const E2E_AGENT = {
  name: 'E2E Assistant',
  description: 'Deterministic assistant for browser acceptance.',
};
export const TEST_USER = E2E_USER;

/**
 * 通过 API 登录获取 token
 */
export async function loginViaApi(page: Page): Promise<void> {
  const response = await page.request.post(`${API_URL}/auth/login`, {
    data: {
      email: E2E_USER.email,
      password: E2E_USER.password,
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

  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.locator('text=Welcome back').waitFor({ state: 'visible', timeout: 10000 });

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

  const stored = await page.evaluate(() => localStorage.getItem('neptune-auth'));
  if (!stored) {
    throw new Error('Failed to set auth in localStorage');
  }
}


/**
 * 拿到当前 e2e 用户的 auth header；登录态由 loginViaApi 提供，
 * 该 helper 只是简化下游 spec 的样板代码。
 */
export async function authHeaders(page: Page): Promise<{Authorization: string}> {
    return page.evaluate(() => {
        const stored = JSON.parse(localStorage.getItem('neptune-auth') || '{}');
        return {Authorization: `Bearer ${stored?.state?.token || ''}`};
    });
}

/**
 * 确保当前 e2e 用户拥有名为 `E2E Assistant` 的受控 controlled-engine 智能体。
 * - 第一次调用：通过 POST /agents 创建（provider=controlled, model=neptune-controlled-model）
 * - 后续调用：返回已存在的同名智能体
 *
 * 解决之前 spec 用 `agents.data[0]` 兜底导致随机抓到非-controlled 智能体、
 * 受控引擎流式断言全部超时的问题。
 *
 * 调用前必须已经 loginViaApi。
 */
export async function ensureE2EAgent(page: Page): Promise<{
    id: string;
    name: string;
    modelConfig: {provider: string; model: string};
}> {
    const headers = await authHeaders(page);
    const listRes = await page.request.get(`${API_URL}/agents`, {headers});
    if (!listRes.ok()) {
        throw new Error(`List agents failed: ${listRes.status()} - ${await listRes.text()}`);
    }
    const list = await listRes.json();
    const existing = list.data.find((agent: {name: string}) => agent.name === E2E_AGENT.name);
    if (existing) return existing;

    const createRes = await page.request.post(`${API_URL}/agents`, {
        headers,
        data: {
            name: E2E_AGENT.name,
            description: E2E_AGENT.description,
            systemPrompt: 'You are a deterministic E2E assistant for browser-acceptance flows.',
            modelConfig: {
                provider: 'controlled',
                model: 'neptune-controlled-model',
                temperature: 0,
                maxTokens: 512,
            },
        },
    });
    if (!createRes.ok()) {
        throw new Error(`Create E2E agent failed: ${createRes.status()} - ${await createRes.text()}`);
    }
    return createRes.json();
}
