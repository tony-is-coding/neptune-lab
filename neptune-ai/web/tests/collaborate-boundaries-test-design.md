# Collaborate 边界场景 E2E 测试设计

> 日期: 2026-05-06
> 作者: tester (测试工程师)
> 状态: 测试用例设计（待实现）

## 测试文件结构

```
web/tests/
├── collaborate-boundaries.spec.ts  # 新增：边界场景 E2E 测试
└── helpers/
    └── collaborate-helpers.ts      # 新增：Collaborate 页面测试辅助函数
```

---

## 测试用例清单

### B0: 零 Agent 场景

**测试套件**: `describe('B0: 零 Agent 场景')`

| 用例 ID | 测试用例 | 前置条件 | 测试步骤 | 预期结果 |
|---------|----------|----------|----------|----------|
| B0-01 | 新用户访问 Collaborate 显示引导卡片 | 租户无 Agent | 1. 访问 `/collaborate`<br>2. 等待页面加载 | - 左侧栏显示 "No AI Employees yet"<br>- 右侧显示引导卡片<br>- 引导卡片包含 "Go to Agents" 按钮 |
| B0-02 | 点击 "Go to Agents" 跳转到 Agents 页面 | 同 B0-01 | 1. 点击 "Go to Agents" 按钮 | - URL 变为 `/agents`<br>- 页面显示 Agent 管理界面 |
| B0-03 | 创建 Agent 后返回 Collaborate 进入 B1 | 同 B0-01 | 1. 点击 "Go to Agents"<br>2. 创建一个 Agent<br>3. 返回 `/collaborate` | - 左侧栏显示新创建的 Agent<br>- 右侧显示 B1 欢迎卡片 |

**Playwright 选择器设计**:
```typescript
// 左侧栏空状态
expect(page.locator('text=No AI Employees yet')).toBeVisible()

// 引导卡片
const emptyCard = page.locator('.text-center.max-w-\\[400px\\]')
await expect(emptyCard.locator('h2:has-text("Find an AI Employee")')).toBeVisible()
await expect(emptyCard.locator('a[href="/agents"]')).toBeVisible()
```

---

### B1: 有 Agent 但零对话场景

**测试套件**: `describe('B1: 有 Agent 但零对话场景')`

| 用例 ID | 测试用例 | 前置条件 | 测试步骤 | 预期结果 |
|---------|----------|----------|----------|----------|
| B1-01 | 从 Agents 页面启动 Collaborate | 存在 Agent 但无 Thread | 1. 在 Agents 页面点击 "Start Collaborate" | - URL 变为 `/collaborate/:agentId`<br>- 右侧显示 Agent 欢迎卡片<br>- 显示建议消息按钮 |
| B1-02 | 左侧栏点击未对话过的 Agent | 同 B1-01 | 1. 在左侧栏点击一个 Agent | - 右侧显示该 Agent 的欢迎卡片<br>- 顶栏显示 "New Thread" |
| B1-03 | 直接访问 URL 显示欢迎卡片 | 同 B1-01 | 1. 直接访问 `/collaborate/:agentId` | - 同 B1-01 |
| B1-04 | 点击建议消息创建 Thread 并发送 | 同 B1-01 | 1. 点击建议消息按钮<br>2. 等待响应 | - Thread 创建成功<br>- 消息发送成功<br>- 界面切换到正常聊天视图 |
| B1-05 | 输入框发送第一条消息 | 同 B1-01 | 1. 在输入框输入内容<br>2. 点击发送 | - 同 B1-04 |
| B1-06 | 刷新页面后 Thread 持久化 | 同 B1-04 | 1. 刷新页面 | - 恢复到聊天视图<br>- 历史消息可见 |

**Playwright 选择器设计**:
```typescript
// 欢迎卡片
const welcomeCard = page.locator('.text-center.max-w-\\[480px\\]')
await expect(welcomeCard.locator('h2')).toHaveText(/.*/)  // Agent 名称
await expect(welcomeCard.locator('p:has-text("Try asking:")')).toBeVisible()

// 建议消息按钮
const suggestedPrompts = page.locator('button.suggested-prompt')
await expect(suggestedPrompts.first()).toBeVisible()

// ChatInput 可用
const chatInput = page.locator('textarea[placeholder*="message"], input[placeholder*="message"]')
await expect(chatInput).toBeEnabled()
```

---

### B2a: Agent 被停用场景

**测试套件**: `describe('B2a: Agent 被停用场景')`

| 用例 ID | 测试用例 | 前置条件 | 测试步骤 | 预期结果 |
|---------|----------|----------|----------|----------|
| B2a-01 | 停用 Agent 后左侧栏灰显 | Agent 存在且有对话 | 1. 在 Agents 页面停用 Agent<br>2. 返回 Collaborate | - 左侧栏该 Agent 条目 `opacity-60`<br>- 显示 "Inactive" 标签 |
| B2a-02 | 点击停用的 Agent 显示只读状态 | 同 B2a-01 | 1. 点击被停用的 Agent | - 历史消息可见<br>- ChatInput 禁用<br>- 显示 "This AI Employee is currently inactive" 横幅 |
| B2a-03 | 切换到活跃 Agent 正常可用 | 同 B2a-01 | 1. 点击另一个活跃的 Agent | - 界面正常可用<br>- ChatInput 可用 |
| B2a-04 | Thread 下拉可切换历史记录 | 同 B2a-01 | 1. 打开 Thread 下拉<br>2. 选择历史 Thread | - 可查看历史 Thread<br>- 消息只读 |

**Playwright 选择器设计**:
```typescript
// 停用 Agent 样式
const inactiveAgent = page.locator(`a[href="/collaborate/${agentId}"].opacity-60`)
await expect(inactiveAgent).toBeVisible()
await expect(inactiveAgent.locator('text=Inactive')).toBeVisible()

// 停用横幅
const inactiveBanner = page.locator('.bg-surface-container:has-text("This AI Employee is currently inactive")')
await expect(inactiveBanner).toBeVisible()

// ChatInput 禁用
const chatInput = page.locator('textarea, input')
await expect(chatInput).toBeDisabled()
```

---

### B2b: Agent 被删除场景

**测试套件**: `describe('B2b: Agent 被删除场景')`

| 用例 ID | 测试用例 | 前置条件 | 测试步骤 | 预期结果 |
|---------|----------|----------|----------|----------|
| B2b-01 | 删除当前 Agent 显示横幅并切换 | 正在查看 Agent-A | 1. 在 Agents 页面删除 Agent-A<br>2. 返回 Collaborate<br>3. 触发任意操作（如发送消息） | - 显示 "AI Employee has been removed" 横幅<br>- 自动切换到下一个可用 Agent |
| B2b-02 | 删除最后一个 Agent 回到 B0 | 只有一个 Agent | 1. 删除该 Agent<br>2. 返回 Collaborate | - 回到 B0 状态<br>- 显示引导卡片 |
| B2b-03 | 左侧栏 Agent 条目消失 | Agent 已删除 | 1. 刷新页面 | - 左侧栏不再显示被删除的 Agent |

**Playwright 选择器设计**:
```typescript
// 删除横幅
const removedBanner = page.locator('.bg-red-50:has-text("AI Employee has been removed")')
await expect(removedBanner).toBeVisible()

// URL 变化检测
await expect(page).toHaveURL(/\/collaborate\/[a-f0-9-]+$/)
const newAgentId = page.url().split('/collaborate/')[1]
```

---

### B3: Agent 运行中状态

**测试套件**: `describe('B3: Agent 运行中状态')`

| 用例 ID | 测试用例 | 前置条件 | 测试步骤 | 预期结果 |
|---------|----------|----------|----------|----------|
| B3-01 | 发送消息后输入框禁用并显示计时器 | Thread 存在 | 1. 发送一条消息<br>2. 等待响应 | - ChatInput 禁用<br>- 显示 "Thinking... Xs" |
| B3-02 | 切换 Agent 后回来计时器继续 | 同 B3-01 | 1. 切换到其他 Agent<br>2. 切换回原 Agent | - 计时器继续计时 |
| B3-03 | 刷新页面恢复运行状态 | 同 B3-01 | 1. 刷新页面 | - 恢复 streaming 状态或显示最终结果 |

**Playwright 选择器设计**:
```typescript
// 运行状态检测
const thinkingIndicator = page.locator('text=/Thinking\\.\\.+\\d+s/')
await expect(thinkingIndicator).toBeVisible()

// ChatInput 禁用
await expect(chatInput).toBeDisabled()

// 计时器递增验证
const timer1 = await thinkingIndicator.innerText()
await page.waitForTimeout(2000)
const timer2 = await thinkingIndicator.innerText()
expect(timer2).not.toBe(timer1)
```

---

### B4: 入口跳转场景

**测试套件**: `describe('B4: 入口跳转场景')`

| 用例 ID | 测试用例 | 前置条件 | 测试步骤 | 预期结果 |
|---------|----------|----------|----------|----------|
| B4-01 | 点击 PrimarySidebar Collaborate 图标 | 有 Agent | 1. 点击 "Collaborate" 图标 | - 自动选第一个 Agent<br>- URL 变为 `/collaborate/:id` |
| B4-02 | 从 Agents 页面 Start Collaborate | 有 Thread | 1. 点击 "Start Collaborate" | - URL 变为 `/collaborate/:agentId`<br>- 加载指定 Thread |
| B4-03 | 直接访问不存在的 Agent ID | - | 1. 访问 `/collaborate/nonexistent-id` | - 重定向到第一个 Agent |
| B4-04 | 直接访问 /collaborate 自动选第一个 | 有 Agent | 1. 访问 `/collaborate` | - URL 变为 `/collaborate/:firstId` |

---

### B5: Loading 与错误状态

**测试套件**: `describe('B5: Loading 与错误状态')`

| 用例 ID | 测试用例 | 前置条件 | 测试步骤 | 预期结果 |
|---------|----------|----------|----------|----------|
| B5-01 | Agent 列表加载中显示 spinner | - | 1. 访问 `/collaborate`<br>2. 拦截 API 延迟响应 | - 左侧栏显示 spinner |
| B5-02 | Agent 列表加载失败显示重试按钮 | API 不可用 | 1. 模拟 API 失败 | - 左侧栏显示 "Failed to load"<br>- 显示 "Retry" 按钮 |
| B5-03 | 点击重试按钮重新加载 | 同 B5-02 | 1. 点击 "Retry" 按钮 | - 重新调用 API<br>- 成功后正常显示 |
| B5-04 | 消息发送失败显示错误横幅 | 网络断开 | 1. 断网<br>2. 发送消息 | - 显示红色错误横幅<br>- 显示 "Retry" 按钮 |
| B5-05 | Token 过期跳转登录页 | Token 过期 | 1. 使用过期 Token | - 跳转到 `/login` |

---

### B6: 搜索过滤场景

**测试套件**: `describe('B6: 搜索过滤场景')`

| 用例 ID | 测试用例 | 前置条件 | 测试步骤 | 预期结果 |
|---------|----------|----------|----------|----------|
| B6-01 | 输入搜索关键词过滤 Agent | 有多个 Agent | 1. 在搜索框输入 "code" | - 只显示名称/描述包含 "code" 的 Agent |
| B6-02 | 清空搜索恢复全部 Agent | 同 B6-01 | 1. 清空搜索框 | - 恢复显示全部 Agent |
| B6-03 | 搜索无匹配显示提示 | 同 B6-01 | 1. 输入 "nonexistent" | - 显示 "No matching agents" |

**Playwright 选择器设计**:
```typescript
// 搜索框
const searchInput = page.locator('input[placeholder*="Search"]')
await searchInput.fill('code')

// 等待防抖
await page.waitForTimeout(350)

// 验证过滤结果
const agents = page.locator('a[href*="/collaborate/"]')
const visibleAgents = await agents.all()
// 验证每个 visibleAgent 的文本包含 "code"
```

---

## 测试辅助函数设计

### `collaborate-helpers.ts`

```typescript
import { Page, Locator } from '@playwright/test';

export class CollaborateHelpers {
  constructor(private page: Page) {}

  // 创建测试 Agent（通过 API）
  async createTestAgent(name: string, description: string): Promise<string> {
    // 实现 API 调用创建 Agent
    // 返回 agentId
  }

  // 删除测试 Agent（通过 API）
  async deleteTestAgent(agentId: string): Promise<void> {
    // 实现 API 调用删除 Agent
  }

  // 停用/启用 Agent（通过 API）
  async setAgentActive(agentId: string, isActive: boolean): Promise<void> {
    // 实现 API 调用更新 Agent 状态
  }

  // 等待欢迎卡片可见
  async waitForWelcomeCard(): Promise<Locator> {
    return this.page.locator('.text-center.max-w-\\[480px\\]').waitFor();
  }

  // 等待引导卡片可见
  async waitForEmptyCard(): Promise<Locator> {
    return this.page.locator('.text-center.max-w-\\[400px\\]').waitFor();
  }

  // 获取当前 Agent ID
  async getCurrentAgentId(): Promise<string> {
    const url = this.page.url();
    const match = url.match(/\/collaborate\/([a-f0-9-]+)$/);
    return match ? match[1] : '';
  }

  // 模拟网络断开
  async simulateOffline(): Promise<void> {
    await this.page.context().setOffline(true);
  }

  // 恢复网络
  async simulateOnline(): Promise<void> {
    await this.page.context().setOffline(false);
  }
}
```

---

## 测试数据准备

### 测试 Fixtures

```typescript
import { test as base } from '@playwright/test';

export const test = base.extend<{
  collaborateHelpers: CollaborateHelpers;
}>({
  collaborateHelpers: async ({ page }, use) => {
    await use(new CollaborateHelpers(page));
  },
});
```

---

## 实现优先级

1. **P0 (高优先级)**: B0, B1 — 核心用户流程
2. **P1 (中优先级)**: B2a, B2b — 边界异常处理
3. **P2 (低优先级)**: B3, B4, B5, B6 — 细节体验优化

---

## 注意事项

1. **测试隔离**: 每个测试用例使用独立的测试数据，避免相互影响
2. **清理策略**: `afterEach` 中清理创建的测试数据
3. **API Mock**: 某些场景可能需要 mock API 响应（如网络错误）
4. **并发测试**: 不同测试套件可以并行运行，但同一套件内串行
5. **CI/CD 集成**: 确保测试可在 CI 环境中稳定运行
