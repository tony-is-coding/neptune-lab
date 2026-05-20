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
  webServer: {
    command: 'npx vite --port=3004 --strictPort',
    port: 3004,
    reuseExistingServer: true,
    timeout: 10000,
  },
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
      name: 'navigation',
      testMatch: 'navigation.spec.ts',
      dependencies: ['auth'],
    },
    {
      name: 'collaborate',
      testMatch: 'collaborate.spec.ts',
      dependencies: ['auth'],
    },
    {
      name: 'controlled-chat',
      testMatch: 'controlled-chat.spec.ts',
      dependencies: ['auth'],
    },
    {
      name: 'advanced-chat',
      testMatch: 'advanced-chat.spec.ts',
      dependencies: ['auth'],
    },
    {
      name: 'sse-recovery',
      testMatch: 'sse-recovery.spec.ts',
      dependencies: ['auth'],
    },
    {
      name: 'thread-stability',
      testMatch: 'thread-stability.spec.ts',
      dependencies: ['auth'],
    },
    {
      name: 'api-alignment',
      testMatch: 'api-alignment.spec.ts',
      dependencies: ['smoke'],
    },
    {
      name: 'auth-401',
      testMatch: 'auth-401-recovery.spec.ts',
      dependencies: ['smoke'],
    },
  ],
});
