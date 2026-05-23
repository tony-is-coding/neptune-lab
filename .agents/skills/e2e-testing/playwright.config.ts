import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 0,
  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },
    actionTimeout: 10000,
    baseURL: 'http://localhost:3004',
  },
  // 不自动启动 web server — 依赖已有的 dev server
  // 后端需在 localhost:3000 运行，前端需在 localhost:3004 运行
  projects: [
    {
      name: 'smoke',
      testMatch: 'smoke.spec.ts',
    },
    {
      name: 'auth',
      testMatch: 'auth.spec.ts',
      dependencies: ['smoke'],
    },
    {
      name: 'agents',
      testMatch: 'agents.spec.ts',
      dependencies: ['auth'],
    },
    {
      name: 'chat-sse',
      testMatch: 'chat-sse.spec.ts',
      dependencies: ['auth'],
    },
    {
      name: 'navigation',
      testMatch: 'navigation.spec.ts',
      dependencies: ['auth'],
    },
  ],
});
