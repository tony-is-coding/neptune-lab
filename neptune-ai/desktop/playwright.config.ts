import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 0,
  use: {
    headless: true,
    viewport: { width: 1200, height: 800 },
    actionTimeout: 10000,
  },
  projects: [
    {
      name: 'smoke',
      testMatch: 'smoke.spec.ts',
    },
    {
      name: 'login',
      testMatch: 'login.spec.ts',
      dependencies: ['smoke'],
    },
    {
      name: 'navigation',
      testMatch: 'navigation.spec.ts',
      dependencies: ['login'],
    },
    {
      name: 'ui-visual',
      testMatch: 'ui-visual.spec.ts',
    },
  ],
});
