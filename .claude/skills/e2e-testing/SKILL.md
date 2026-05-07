---
name: e2e-testing
description: 前端改动后自动运行 Playwright 测试套件，覆盖认证/Agent管理/对话SSE/UI渲染全流程。用于 web/src/** 下的任何前端文件修改。
---

# E2E Testing — Playwright 浏览器自动化

## 触发时机

任何 `web/src/**` 下的文件修改完成后，自动运行测试套件。

## 执行方式

```bash
npx playwright test --config=.claude/skills/e2e-testing/playwright.config.ts
```

## 前置条件

测试运行前必须确保：
1. 后端 server 在 `localhost:3000` 运行（`cd server && bun run dev`）
2. 前端 dev server 在 `localhost:3004` 运行（`cd web && bun run dev`）
3. 数据库和 Redis 已启动（`cd server && docker-compose up -d`）
4. 默认管理员账户存在（admin@neptune.ai / admin）

如果 server 未运行，先启动再测试。如果启动失败，报告错误给用户。

## 测试覆盖要求

### 1. 认证流程（auth.spec.ts）
- [ ] 登录页正确渲染
- [ ] 正确凭证登录成功，跳转到主页
- [ ] 错误凭证登录失败，显示错误提示
- [ ] 注册新用户成功
- [ ] Token 持久化到 localStorage
- [ ] 无效 token 自动清除并跳转登录页（401 恢复）

### 2. Agent 管理（agents.spec.ts）
- [ ] Agent 列表页正确渲染
- [ ] 创建新 Agent
- [ ] 查看 Agent 详情/配置
- [ ] 编辑 Agent 配置
- [ ] 激活/停用 Agent

### 3. 对话流程 SSE（chat-sse.spec.ts）
- [ ] 进入 Agent 对话页
- [ ] 创建新 Thread
- [ ] 发送消息，接收 SSE 流式回复
- [ ] 工具调用状态展示（running → completed）
- [ ] 错误处理（网络断开、server 错误）
- [ ] Thread 列表切换
- [ ] 历史记录加载

### 4. UI 渲染与导航（navigation.spec.ts）
- [ ] 侧边栏导航正确渲染
- [ ] 页面路由切换正常
- [ ] 活跃页面高亮
- [ ] 响应式布局（桌面/平板/手机）
- [ ] 无 console 错误
- [ ] 无视觉回归（关键页面截图对比）

## 新测试用例编写规范

每个新功能必须新增测试覆盖：

1. **文件命名**：`<feature>.spec.ts`，放在 `tests/` 目录下
2. **最少覆盖**：1 个冒烟测试 + 1 个正常流程测试
3. **公共工具**：使用 `tests/helpers.ts` 的工具函数
   - `loginViaApi(page)` — API 登录，跳过 UI 登录流程
   - `waitForApiCall(page, urlPattern)` — 等待特定 API 调用完成
4. **测试数据**：通过 API 创建，不依赖 UI 预置数据
5. **SSE 测试**：对 SSE 端点使用 route mock，不依赖真实大模型 API
6. **断言标准**：
   - 可见性断言用 `toBeVisible()`
   - 文本内容用 `toContainText()`
   - API 调用用 `waitForResponse()`
   - 避免 `waitForTimeout()`，用显式等待代替

### 测试文件模板

```typescript
import { test, expect } from '@playwright/test';
import { loginViaApi } from './helpers';

test.describe('<Feature Name>', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page);
  });

  test('冒烟测试：页面正常渲染', async ({ page }) => {
    await page.goto('/<path>');
    await expect(page.locator('<key-element>')).toBeVisible();
  });

  test('正常流程：<描述>', async ({ page }) => {
    // Arrange
    // Act
    // Assert
  });
});
```

## 测试结果处理

### 全部通过
报告通过数量，继续工作。

### 测试失败
1. 分析失败原因：是本次改动引起的，还是已有 bug
2. 如果是本次改动引起的：修复代码，重新运行测试
3. 如果是已有 bug：记录到 `memory/` 并报告给用户
4. 不要为了通过测试而修改测试用例（除非测试本身有 bug）

### 测试不稳定（flaky）
1. 标记为 `@slow` 或增加超时
2. 记录不稳定模式到 `memory/`
3. 修复根本原因，不增加 `waitForTimeout`

## Memory 机制

在 `memory/` 下记录测试策略演进：

```
memory/
├── 2026-05-06-test-strategy.md    # 测试覆盖策略
├── 2026-05-06-sse-mock-approach.md # SSE mock 方案
└── YYYY-MM-DD-<topic>.md          # 后续演进
```

格式：
```markdown
# <Topic>
> 日期：YYYY-MM-DD

## 决策
（做了什么测试策略决策）

## 原因
（为什么这样决定）

## 影响
（对现有测试的影响）
```
