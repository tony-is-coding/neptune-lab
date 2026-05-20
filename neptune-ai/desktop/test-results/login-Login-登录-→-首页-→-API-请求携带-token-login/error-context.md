# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: login.spec.ts >> Login >> 登录 → 首页 → API 请求携带 token
- Location: tests/login.spec.ts:5:3

# Error details

```
Error: Should navigate away from /login

expect(received).not.toContain(expected) // indexOf

Expected substring: not "/login"
Received string:        "http://localhost:1420/login"
```

# Page snapshot

```yaml
- generic [ref=e5]:
  - generic [ref=e6]:
    - generic [ref=e7]: "N"
    - generic [ref=e8]: Neptune-AI
  - heading "Welcome back" [level=1] [ref=e9]
  - paragraph [ref=e10]: Sign in to continue to Neptune-AI
  - generic [ref=e11]: Network Error
  - button "Continue with Google" [ref=e12]:
    - img [ref=e13]
    - generic [ref=e18]: Continue with Google
  - generic [ref=e21]: or sign in with email
  - generic [ref=e23]:
    - generic [ref=e24]:
      - generic [ref=e25]: Email
      - textbox "Email" [ref=e26]:
        - /placeholder: you@company.com
        - text: terrence@neptune.ai
    - generic [ref=e27]:
      - generic [ref=e28]: Password
      - textbox "Password" [ref=e29]:
        - /placeholder: Enter your password
        - text: Neptune2024!
    - generic [ref=e30]:
      - generic [ref=e31] [cursor=pointer]:
        - checkbox "Remember for 30 days" [ref=e32]
        - text: Remember for 30 days
      - button "Forgot password?" [ref=e33]
    - button "Sign In" [ref=e34]
  - button "Don't have an account? Sign up" [ref=e36]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import { attachDiagnostics, printReport, DEV_URL, TEST_USER } from './helpers';
  3  | 
  4  | test.describe('Login', () => {
  5  |   test('登录 → 首页 → API 请求携带 token', async ({ page }) => {
  6  |     const diag = attachDiagnostics(page);
  7  | 
  8  |     await page.goto(`${DEV_URL}/login`);
  9  |     await page.waitForLoadState('networkidle');
  10 | 
  11 |     await page.fill('input[type="email"]', TEST_USER.email);
  12 |     await page.fill('input[type="password"]', TEST_USER.password);
  13 |     await page.click('button[type="submit"]');
  14 | 
  15 |     // 等足够时间让登录+跳转+API请求全部完成
  16 |     await page.waitForTimeout(5000);
  17 | 
  18 |     const currentUrl = page.url();
  19 |     const stored = await page.evaluate(() => localStorage.getItem('neptune-auth'));
  20 |     printReport(diag, currentUrl, stored);
  21 | 
  22 |     expect(diag.errors.length, `Page errors: ${diag.errors.join('; ')}`).toBe(0);
> 23 |     expect(currentUrl, 'Should navigate away from /login').not.toContain('/login');
     |                                                                ^ Error: Should navigate away from /login
  24 |     expect(stored, 'Auth should be persisted').not.toBeNull();
  25 | 
  26 |     const parsed = JSON.parse(stored!);
  27 |     expect(parsed?.state?.isAuthenticated).toBe(true);
  28 |     expect(parsed?.state?.token).toBeTruthy();
  29 |   });
  30 | 
  31 |   test('登录后刷新页面保持认证状态', async ({ page }) => {
  32 |     const diag = attachDiagnostics(page);
  33 | 
  34 |     // 先登录
  35 |     await page.goto(`${DEV_URL}/login`);
  36 |     await page.waitForLoadState('networkidle');
  37 |     await page.fill('input[type="email"]', TEST_USER.email);
  38 |     await page.fill('input[type="password"]', TEST_USER.password);
  39 |     await page.click('button[type="submit"]');
  40 | 
  41 |     // 等登录完成
  42 |     await page.waitForTimeout(5000);
  43 | 
  44 |     // 刷新页面
  45 |     await page.reload();
  46 |     await page.waitForLoadState('networkidle');
  47 |     await page.waitForTimeout(3000);
  48 | 
  49 |     const currentUrl = page.url();
  50 |     const stored = await page.evaluate(() => localStorage.getItem('neptune-auth'));
  51 |     printReport(diag, currentUrl, stored);
  52 | 
  53 |     expect(currentUrl, 'Should stay on / after refresh').not.toContain('/login');
  54 |     expect(JSON.parse(stored!)?.state?.isAuthenticated).toBe(true);
  55 |   });
  56 | 
  57 |   test('错误密码返回 401 并留在登录页', async ({ page }) => {
  58 |     const diag = attachDiagnostics(page);
  59 | 
  60 |     await page.goto(`${DEV_URL}/login`);
  61 |     await page.waitForLoadState('networkidle');
  62 | 
  63 |     await page.fill('input[type="email"]', TEST_USER.email);
  64 |     await page.fill('input[type="password"]', 'wrong-password');
  65 |     await page.click('button[type="submit"]');
  66 | 
  67 |     await page.waitForTimeout(4000);
  68 | 
  69 |     const currentUrl = page.url();
  70 |     const stored = await page.evaluate(() => localStorage.getItem('neptune-auth'));
  71 |     printReport(diag, currentUrl, stored);
  72 | 
  73 |     expect(currentUrl, 'Should stay on /login').toContain('/login');
  74 |     // 验证后端返回了 401
  75 |     const has401 = diag.requests.some(r => r.includes('401'));
  76 |     expect(has401, 'Should have received 401 from backend').toBeTruthy();
  77 |   });
  78 | });
  79 | 
```