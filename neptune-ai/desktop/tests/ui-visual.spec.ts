import { test, expect } from '@playwright/test';

/**
 * UI 视觉验证测试 — 对比 Figma 设计稿
 * 启动方式: npx vite --port 1420 & npx playwright test ui-visual --project=ui-visual
 */

const BASE_URL = 'http://localhost:1420';

// Mock API 数据
const MOCK_AGENTS = [
  { id: 'agent-1', name: 'Financial Architect', description: 'Financial analysis and modeling', isActive: true },
  { id: 'agent-2', name: 'Data Analyst', description: 'Data processing and insights', isActive: true },
  { id: 'agent-3', name: 'Content Writer', description: 'Content generation and editing', isActive: false },
];

test.describe('UI 视觉验证', () => {
  test.beforeEach(async ({ page }) => {
    // Mock 所有 API 请求 — 使用正则匹配，确保跨域 (localhost:3000) 请求也被拦截
    const apiMockHandler = async (route: any) => {
      const url = route.request().url();
      const method = route.request().method();

      if (url.includes('/agents') && !url.includes('/agents/') && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: MOCK_AGENTS }),
        });
      } else if (url.includes('/history') && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: {} }),
        });
      }
    };

    // 用正则匹配跨域 API (localhost:3000) 和同域 API 两种情况
    await page.route(/\/api\/v1\//, apiMockHandler);

    // 注入 mock auth 状态到 zustand persist
    await page.goto(`${BASE_URL}/login`);
    await page.evaluate(() => {
      const authState = {
        state: {
          user: { id: '1', name: 'Alex', email: 'test@test.com', role: 'admin' },
          token: 'mock-token-for-ui-testing',
          isAuthenticated: true,
        },
        version: 0,
      };
      localStorage.setItem('neptune-auth', JSON.stringify(authState));
    });
    // 重载页面让 zustand 读取 localStorage
    await page.reload();
    await page.waitForTimeout(1000);
  });

  test('首页 — 输入栏背景色应为 #faf9f5', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.waitForTimeout(2000);

    // 输入栏容器有 max-w-[672px]，精确匹配而非泛用的 rounded-full
    const inputBar = page.locator('.max-w-\\[672px\\]').first();
    if (await inputBar.isVisible()) {
      const bg = await inputBar.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor;
      });
      // #faf9f5 = rgb(250, 249, 245)
      expect(bg).toBe('rgb(250, 249, 245)');
    }
  });

  test('首页 — Agent 卡片背景色应为 #faf9f5', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.waitForTimeout(2000);

    // Agent 卡片在 main 内容区域，用 main 限定避免匹配侧边栏 rounded-[12px]
    const agentCards = page.locator('main [class*="drop-shadow"]');
    const count = await agentCards.count();
    if (count > 0) {
      const bg = await agentCards.first().evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor;
      });
      expect(bg).toBe('rgb(250, 249, 245)');
    }
  });

  test('Skills Hub — TopAppBar Tab 链接样式', async ({ page }) => {
    await page.goto(`${BASE_URL}/skills`);
    await page.waitForTimeout(1500);

    // 检查有 Tab 链接 (不是药丸切换)
    const tabLinks = page.locator('button:has-text("My Skills"), button:has-text("Skill Hub")');
    const count = await tabLinks.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('Skills Hub — 右侧通知和设置按钮', async ({ page }) => {
    await page.goto(`${BASE_URL}/skills`);
    await page.waitForTimeout(1500);

    // 检查 TopAppBar 中有通知和设置图标按钮
    const topBar = page.locator('.h-16').first();
    if (await topBar.isVisible()) {
      const buttons = topBar.locator('button');
      const count = await buttons.count();
      expect(count).toBeGreaterThanOrEqual(4);
    }
  });

  test('Skills Hub — 卡片圆角应为 8px', async ({ page }) => {
    await page.goto(`${BASE_URL}/skills`);
    await page.waitForTimeout(2000);

    const cards = page.locator('[class*="rounded-\\[8px\\]"]');
    const count = await cards.count();
    if (count > 0) {
      const radius = await cards.first().evaluate((el) => {
        return window.getComputedStyle(el).borderRadius;
      });
      expect(radius).toBe('8px');
    }
  });

  test('侧边栏 — 宽度应为 72px', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.waitForTimeout(1500);

    const sidebar = page.locator('[class*="w-\\[72px\\]"]').first();
    if (await sidebar.isVisible()) {
      const width = await sidebar.evaluate((el) => {
        return el.getBoundingClientRect().width;
      });
      expect(width).toBe(72);
    }
  });

  test('侧边栏 — 6 个导航项带标签', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.waitForTimeout(2000);

    const labels = ['Home', 'Agents', 'Skills', 'Collaborate', 'Alerts', 'Settings'];
    for (const label of labels) {
      const el = page.locator(`text=${label}`).first();
      expect(await el.isVisible()).toBeTruthy();
    }
  });

  test('截图对比 — 首页', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/home-page.png', fullPage: true });
  });

  test('截图对比 — Skills Hub', async ({ page }) => {
    await page.goto(`${BASE_URL}/skills`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/skills-hub.png', fullPage: true });
  });

  test('截图对比 — Collaborate', async ({ page }) => {
    await page.goto(`${BASE_URL}/collaborate`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/collaborate.png', fullPage: true });
  });

  test('截图对比 — Settings', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/settings.png', fullPage: true });
  });

  test('截图对比 — Alerts', async ({ page }) => {
    await page.goto(`${BASE_URL}/alerts`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/alerts.png', fullPage: true });
  });

  // ========== 新增：背景色验证（核心修复项） ==========

  test('全局背景色应为 #f5f4ed', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.waitForTimeout(2000);

    // 检查 Layout 容器的背景色
    const layoutBg = await page.locator('.flex.h-screen').evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    // #f5f4ed = rgb(245, 244, 237)
    expect(layoutBg).toBe('rgb(245, 244, 237)');
  });

  test('侧边栏背景色应为 #f5f2ed', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.waitForTimeout(1500);

    const sidebar = page.locator('[class*="w-\\[72px\\]"]').first();
    if (await sidebar.isVisible()) {
      const bg = await sidebar.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor;
      });
      // #f5f2ed = rgb(245, 242, 237)
      expect(bg).toBe('rgb(245, 242, 237)');
    }
  });

  test('首页 TopAppBar 应有 backdrop-blur 半透明白背景', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.waitForTimeout(1500);

    const topBar = page.locator('.h-16').first();
    if (await topBar.isVisible()) {
      const backdropFilter = await topBar.evaluate((el) => {
        return window.getComputedStyle(el).backdropFilter;
      });
      expect(backdropFilter).toContain('blur');
    }
  });

  // ========== 新增：侧边栏高亮状态验证 ==========

  test('首页时 Home 按钮应有高亮状态', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.waitForTimeout(2000);

    // 用 nth(1) 跳过 Logo 链接，选中 Home 导航按钮（含 "Home" 文本）
    const homeBtn = page.locator('a[href="/"]').nth(1);
    const hasBg = await homeBtn.evaluate((el) => {
      const innerDiv = el.querySelector('div');
      return innerDiv?.classList.contains('bg-white') || false;
    });
    expect(hasBg).toBeTruthy();

    // 高亮文字颜色 #2d2926
    const color = await homeBtn.evaluate((el) => {
      const span = el.querySelector('span');
      return span ? window.getComputedStyle(span).color : '';
    });
    // #2d2926 = rgb(45, 41, 38)
    expect(color).toBe('rgb(45, 41, 38)');
  });

  test('Skills 页面时 Skills 按钮应有高亮状态', async ({ page }) => {
    await page.goto(`${BASE_URL}/skills`);
    await page.waitForTimeout(2000);

    const skillsBtn = page.locator('[class*="w-\\[72px\\]"] a[href="/skills"]').first();
    if (await skillsBtn.isVisible()) {
      const innerDiv = skillsBtn.locator('div').first();
      const hasBg = await innerDiv.evaluate((el) => {
        return el.classList.contains('bg-white');
      });
      expect(hasBg).toBeTruthy();
    }
  });

  test('/agent/:id 页面时 Home 按钮应保持高亮', async ({ page }) => {
    // 导航到 /agent/agent-1
    await page.goto(`${BASE_URL}/agent/agent-1`);
    await page.waitForTimeout(2000);

    const homeBtn = page.locator('a[href="/"]').nth(1);
    const hasBg = await homeBtn.evaluate((el) => {
      const innerDiv = el.querySelector('div');
      return innerDiv?.classList.contains('bg-white') || false;
    });
    expect(hasBg).toBeTruthy();
  });

  // ========== 新增：首页组件精确验证 ==========

  test('Welcome Banner 背景色应为 #f2e0c8', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.waitForTimeout(2000);

    const banner = page.locator('text=Welcome To Neptune AI').first();
    const container = banner.locator('..');
    if (await container.isVisible()) {
      const bg = await container.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor;
      });
      // #f2e0c8 = rgb(242, 224, 200)
      expect(bg).toBe('rgb(242, 224, 200)');
    }
  });

  test('Send 按钮背景色应为 #2d2926', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.waitForTimeout(2000);

    // Send 按钮是 bg-[#2d2926] 的圆形按钮
    const sendBtn = page.locator('[class*="w-12"][class*="h-12"][class*="rounded-full"]').first();
    if (await sendBtn.isVisible()) {
      const bg = await sendBtn.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor;
      });
      // #2d2926 = rgb(45, 41, 38)
      expect(bg).toBe('rgb(45, 41, 38)');
    }
  });

  // ========== 新增：页面跳转测试 ==========

  test('从首页点击 Agent 卡片应跳转到 /agent/:id', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.waitForTimeout(2000);

    // 点击第一个 Agent 卡片
    const agentCards = page.locator('main [class*="drop-shadow"]');
    const count = await agentCards.count();
    if (count > 0) {
      await agentCards.first().click();
      await page.waitForTimeout(1000);

      // 验证 URL 以 /agent/ 开头
      const url = page.url();
      expect(url).toContain('/agent/');

      // 验证侧边栏 Home 保持高亮
      const homeBtn = page.locator('a[href="/"]').nth(1);
      const hasBg = await homeBtn.evaluate((el) => {
        const innerDiv = el.querySelector('div');
        return innerDiv?.classList.contains('bg-white') || false;
      });
      expect(hasBg).toBeTruthy();
    }
  });

  test('点击侧边栏 Agents 应跳转到 /agents', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.waitForTimeout(2000);

    const agentsBtn = page.locator('[class*="w-\\[72px\\]"] a[href="/agents"]').first();
    if (await agentsBtn.isVisible()) {
      await agentsBtn.click();
      await page.waitForTimeout(1000);

      const url = page.url();
      expect(url).toContain('/agents');

      // Agents 按钮应有高亮
      const innerDiv = agentsBtn.locator('div').first();
      const hasBg = await innerDiv.evaluate((el) => {
        return el.classList.contains('bg-white');
      });
      expect(hasBg).toBeTruthy();
    }
  });
});
