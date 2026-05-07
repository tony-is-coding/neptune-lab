# Collaborate 页面重构设计（实现级 Spec）

> 日期: 2026-05-06
> 状态: v3（实现级文档 — 团队可直接据此开发）
> 前序: v2 已修正 spec review 反馈

---

## 1. 背景与目标

### 1.1 当前问题

当前 Collaborate 由两个页面组成：
- `/collaborate` → `CollaborateLanding`（最近协作记录列表页）
- `/collaborate/:agentId` → `Collaborate`（三栏聊天界面）

问题清单：
1. **页面割裂**：用户必须先经过列表页，再点击某个 Agent 才能进入聊天
2. **边界处理缺失**：零 Agent、零对话、Agent 被停用/删除等场景处理粗糙
3. **引导逻辑不清晰**：空状态引导文字和跳转目标不够精确
4. **Agent 列表只加载 active**：`listAgents({ active: true })` 导致停用的 Agent 不可见
5. **搜索框未接线**：左侧 Agent 搜索框存在但无过滤逻辑
6. **Thread 切换是覆盖面板**：遮挡聊天区域，交互不流畅

### 1.2 目标

将两个路由合并为单一页面组件，所有边界场景有明确定义，团队能直接按此文档实现。

---

## 2. 全局架构关系

```
┌─────────────────────────────────────────────────────────────────┐
│                     PrimarySidebar (72px 固定)                   │
│  Home | Agents | Skills | Collaborate | ... | Alerts | Settings │
└────────┬────────────┬─────────────────────────┬─────────────────┘
         │            │                         │
         ▼            ▼                         ▼
    Home 页面     Agents 页面              Collaborate 页面
    (仪表盘)    ┌──────────┐     ┌──────────────────────────────┐
               │ Agent CRUD│     │  左栏: Agent 列表 (只读镜像)  │
               │ Agent 启停│     │  右栏: 聊天区                 │
               │ 空列表引导 │     │                              │
               └─────┬─────┘     └──────────────────────────────┘
                     │                        ▲
                     │   "Start Collaborate"  │
                     └──────── navigate ───────┘
                        /collaborate/:agentId
```

**职责边界**：
- **Agents 页面**（管理侧）：Agent 的创建、编辑、删除、启停。自己处理空列表引导（引导创建 Agent）
- **Collaborate 页面**（工作侧）：对话界面。依赖 Agents 中已存在的 Agent。引导去 `/agents` **浏览找 Agent**，不直接跳转创建

**依赖关系**：Collaborate 每个对话的 Agent 必须在 Agents 页面中存在（即 `agent_templates` 表中有记录）

---

## 3. 数据模型

### 3.1 Thread ↔ Session 映射

前端使用 "Thread" 概念，对应后端 `sessions` 表。ThreadManager 已实现完整 CRUD：

| 前端 Thread 字段 | 后端 sessions 字段 | 类型 | 说明 |
|-----------------|-------------------|------|------|
| `id` | `id` | string | UUID |
| `tenantId` | `tenant_id` | string | 租户 ID |
| `userId` | `user_id` | string | 用户 ID |
| `templateId` | `template_id` | string | = agentId |
| `status` | `status` | `'running' \| 'idle' \| 'completed' \| 'error'` | Thread 状态 |
| `title` | `title` | string \| null | Thread 标题 |
| `summary` | `summary` | string \| null | 摘要 |
| `workspace` | `workspace` | string | 工作目录路径 |
| `lastActiveAt` | `last_active_at` | string \| null | ISO 时间戳 |
| `createdAt` | `created_at` | string | ISO 时间戳 |
| `updatedAt` | `updated_at` | string | ISO 时间戳 |

### 3.2 AgentTemplate 类型

```typescript
interface AgentTemplate {
  id: string
  tenantId: string
  name: string
  description: string | null
  icon: string              // Material Symbols icon name，默认 'smart_toy'
  systemPrompt: string
  modelConfig: {
    provider: string
    model: string
    temperature: number
    maxTokens: number
  }
  tools: string[]
  skills: Array<{ id: string; name: string; version?: string }>
  mcpServers: Array<{ name: string; url: string; authConfig?: Record<string, unknown> }>
  constraints: {
    maxTokensPerTurn?: number
    maxTurnsPerSession?: number
    maxConcurrentSessions?: number
  }
  version: number
  isActive: boolean         // 是否启用
  createdAt: string
  updatedAt: string
}
```

### 3.3 新增类型：AgentWithSummary

```typescript
interface AgentWithSummary extends AgentTemplate {
  threadSummary?: {
    totalThreads: number
    latestStatus: 'running' | 'idle' | 'completed' | 'error' | null
    latestThreadTitle: string | null
    lastActiveAt: string | null
  }
}
```

---

## 4. 路由变更

### 4.1 路由表

| 旧路由 | 新路由 | 页面组件 | 说明 |
|--------|--------|---------|------|
| `/collaborate` → `CollaborateLanding` | `/collaborate` → `Collaborate` | `Collaborate` | 合并，不再有独立列表页 |
| `/collaborate/:agentId` → `Collaborate` | `/collaborate/:agentId` → `Collaborate` | `Collaborate` | 不变 |

### 4.2 App.tsx 变更

**删除**：
```typescript
import { CollaborateLanding } from './pages/CollaborateLanding';
```

**修改路由**：
```typescript
// 旧
<Route path="/collaborate" element={<CollaborateLanding />} />
<Route path="/collaborate/:agentId" element={<Collaborate />} />

// 新
<Route path="/collaborate" element={<Collaborate />} />
<Route path="/collaborate/:agentId" element={<Collaborate />} />
```

两个路由指向同一个组件。`Collaborate` 组件内部根据 `agentId` 参数判断行为。

### 4.3 PrimarySidebar 变更

```typescript
// Collaborate 图标的 active 判定需覆盖两个路由
const isActive = location.pathname === to ||
  (to === '/collaborate' && location.pathname.startsWith('/collaborate'));
```

当前代码 `location.pathname.startsWith(`${to}`)` 对 `/collaborate` 已经匹配 `/collaborate/:agentId`，无需修改。

---

## 5. 页面布局规格

### 5.1 整体结构

```
┌─────────────────────────────────────────────────────────────────────┐
│ PrimarySidebar (72px fixed) │  Collaborate 页面 (flex-1)           │
│                             │ ┌──────────┬─────────────────────────┐│
│                             │ │ Agent    │  顶栏: Agent名+Thread切换││
│                             │ │ 列表栏   │─────────────────────────││
│                             │ │          │                         ││
│                             │ │ 240px    │     消息区域             ││
│                             │ │ 可调     │     max-w-4xl            ││
│                             │ │ 200-400  │                         ││
│                             │ │          │─────────────────────────││
│                             │ │          │  TaskBar + ChatInput     ││
│                             │ └──────────┴─────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 左侧栏（Agent 列表）

**尺寸**：
- 默认宽度: 240px
- 可调范围: 200-400px
- 使用现有 `useResizableSidebar(240, 200, 400)` hook
- 右边缘 1px 拖拽手柄，hover 时 `bg-brand/50`

**CSS 结构**：
```
div.flex.h-full.bg-surface-container-low
├── div[左栏].h-full.bg-surface-container.border-r.border-surface-container-highest.flex.flex-col.shrink-0.relative
│   style={{ width: sidebarWidth }}
│   ├── div[头部].p-6.pb-4.border-b.border-surface-container-highest
│   │   ├── h2 "AI Employees" text-[12px] font-bold text-stone uppercase tracking-widest
│   │   └── div[搜索框].relative
│   │       ├── span.material-symbols-outlined "search" text-[18px]
│   │       └── input w-full pl-9 pr-3 py-2 bg-surface-container-highest rounded-lg text-sm
│   │           placeholder="Search agents..." 300ms debounce
│   │
│   ├── div[列表区].flex-grow.overflow-y-auto.p-3.space-y-1.custom-scrollbar
│   │   └── (Agent 条目列表，见 5.2.1)
│   │
│   ├── div[拖拽手柄].absolute.right-0.top-0.bottom-0.w-1.cursor-col-resize
│   │   hover:bg-brand/50 z-50
│   │
│   └── (无底部按钮，Agent 创建属于 Agents 页面职责)
```

**5.2.1 Agent 条目**

每个 Agent 条目：

```
a[href=/collaborate/:agentId].w-full.flex.items-center.gap-3.p-3.rounded-xl.transition-colors
  ├── div[头像].w-8.h-8.rounded-full.bg-ivory.flex.items-center.justify-center.shrink-0.shadow-sm.border
  │   ├── span.material-symbols-outlined text-[16px] {agent.icon || 'smart_toy'}
  │   └── div[状态点].absolute.bottom-0.right-0.w-2.5.h-2.5.border-2.rounded-full
  │       (位置：相对于头像容器 absolute)
  │
  └── div[信息].overflow-hidden
      ├── p[名称] text-sm truncate
      └── p[描述] text-[11px] text-stone truncate
```

**状态点颜色规则**（依赖 `threadSummary`）：

| threadSummary.latestStatus | 状态点 | 额外样式 |
|---------------------------|--------|---------|
| `'running'` | 绿点 `bg-[#4ade80]` | `animate-pulse` |
| `'idle'` / `'completed'` | 灰点 `bg-stone-400` | 无 |
| `null`（无 Thread） | 不显示状态点 | — |
| — (agent.isActive=false) | 不显示状态点 | 整条目灰显 |

**Agent 条目选中态 vs 未选中态**：

```css
/* 选中 */
bg-surface-container-highest text-charcoal border-border-cream/50 shadow-sm font-semibold

/* 未选中 */
hover:bg-surface-container-highest/60 border-transparent text-charcoal

/* 停用 (isActive=false) */
opacity-60 + 条目右侧显示 "Inactive" 标签
```

**停用 Agent 的 "Inactive" 标签**：
```
span.text-[9px].font-semibold.text-stone.bg-surface-container.px-1.5.py-0.5.rounded.uppercase
```

### 5.3 顶栏（Thread 切换）

**尺寸**：固定 h-16 (64px)

**CSS 结构**：
```
header.absolute.top-0.w-full.h-16.border-b.border-surface-container-highest
  bg-surface-container-low/80.backdrop-blur-md.flex.items-center.px-8.z-30.justify-between
  ├── div[左侧: Agent 信息].flex.items-center.gap-4
  │   ├── div[头像+状态].relative
  │   │   ├── div.w-8.h-8.rounded-full.bg-secondary-container
  │   │   │   span.material-symbols-outlined {agent.icon}
  │   │   └── div[状态点].absolute.bottom-0.right-0.w-2.5.h-2.5.border-2.rounded-full
  │   └── div[文字]
  │       ├── h2[Agent名称] text-[16px] font-semibold text-charcoal
  │       └── span[状态文字] text-[11px] text-stone font-medium
  │
  └── div[右侧: Thread 下拉].flex.items-center.gap-2
      └── ThreadDropdown 组件 (见 5.3.1)
```

**5.3.1 ThreadDropdown 组件**

**触发按钮**：
```
button.flex.items-center.gap-2.px-3.py-1.5.rounded-lg
  hover:bg-surface-container.transition-colors.text-sm
  ├── span[当前Thread标题].font-medium.text-charcoal.truncate.max-w-[200px]
  │   (无 Thread 时显示 "New Thread")
  ├── span.material-symbols-outlined "expand_more" text-[18px] text-stone
  │   (打开时变为 "expand_up")
  └── div[Thread状态点].w-2.h-2.rounded-full
```

**下拉面板**（展开时）：
```
div.absolute.top-full.right-0.mt-2.w-[320px]
  bg-surface-container.border.border-surface-container-highest.rounded-xl.shadow-lg.z-40
  ├── div[Thread 列表].max-h-[320px].overflow-y-auto.p-2
  │   └── (ThreadItem 条目，复用现有组件)
  │       每条增加: 左侧色条 (当前选中) + 相对时间 + 状态点
  │
  └── div[底部按钮].p-2.border-t.border-surface-container-highest
      button.w-full.py-2.rounded-lg.text-[11px].font-medium.text-stone
        hover:text-charcoal.hover:bg-surface-container-highest/60
        span.material-symbols-outlined "add" + "New Thread"
```

**下拉交互**：
- 点击触发按钮 → 切换展开/收起
- 点击外部 → 收起（使用 `useEffect` + `mousedown` listener）
- 按 `Escape` → 收起
- 选择一个 Thread → `switchThread(threadId)` + 收起
- 点击 "New Thread" → `createNewThread()` + 收起

### 5.4 聊天区域

**尺寸**：flex-1 填满剩余空间

**CSS 结构**：
```
section.flex-1.flex.flex-col.border-r.border-surface-container-highest.pt-16
  transition-all.duration-300.items-center.min-h-0.relative
  (有 Artifact 面板时: w-[40%] min-w-[360px] max-w-[500px])
  (无 Artifact 面板时: flex-1)
  ├── div[消息区域].flex-1.min-h-0.overflow-y-auto.custom-scrollbar.p-6.space-y-6
  │   .w-full.max-w-4xl.flex.flex-col
  │   └── (消息列表 / 空状态 / 欢迎卡片，见第 6 节)
  │
  ├── TaskBar (复用)
  └── ChatInput (复用)
      prop: agentName, onSend, disabled
      disabled 条件: isStreaming || activeThread?.status === 'running' || agent.isActive === false
```

---

## 6. 边界场景完整规格

### B0: 零 Agent

**触发条件**：新注册用户 或 所有 Agent 被删除

**API 返回**：`GET /api/v1/agents?include=thread_summary` → `{ data: [] }`

**左侧栏**：
```
div[列表区]
  └── div.flex.items-center.justify-center.h-32
      └── span.text-[11px].text-stone "No AI Employees yet"
```
搜索框保留但无内容可搜。

**右侧（全屏引导卡片）**：

```
div.flex-1.flex.items-center.justify-center.h-full
  └── div.text-center.max-w-[400px]
      ├── div.w-20.h-20.rounded-full.bg-surface-container-low.flex.items-center.justify-center.mx-auto.mb-6
      │   └── span.material-symbols-outlined text-[40px] text-stone "smart_toy"
      ├── h2.font-serif.text-[24px].text-charcoal.mb-3
      │   "Find an AI Employee to collaborate with"
      ├── p.text-sm.text-stone.leading-relaxed.mb-6
      │   "Browse your AI Employees and start working together."
      └── Link[to="/agents"].inline-flex.items-center.gap-2
          .px-6.py-2.5.rounded-lg.font-semibold.text-sm
          .bg-brand.text-white.hover:bg-brand/90.transition-colors.shadow-sm
          ├── span.material-symbols-outlined text-[18px] "arrow_forward"
          └── "Go to Agents →"
```

**关键**：
- 引导去 `/agents`（Agents 浏览页），不是 `/agents/create`
- 不出现 "Create Agent" 字样，因为创建是 Agents 页面的职责
- URL 状态：`/collaborate`（无 agentId，不自动跳转）

**测试用例**：
1. 新用户首次访问 `/collaborate` → 看到引导卡片
2. 点击 "Go to Agents" → 跳转 `/agents`
3. 在 Agents 页创建 Agent 后返回 Collaborate → 左侧栏出现新 Agent，右侧变为 B1

---

### B1: 有 Agent 但零对话

**触发条件**：
- 场景 A: 从 Agents 页面点击 "Start Collaborate" 按钮 → navigate `/collaborate/:agentId`
- 场景 B: 左侧栏点击一个从未对话过的 Agent
- 场景 C: URL 直接访问 `/collaborate/:agentId`，该 Agent 无 Thread

**API 返回**：
- `GET /api/v1/agents/:agentId/threads` → `{ data: [] }`

**左侧栏**：正常显示 Agent 列表，当前 Agent 高亮。

**顶栏**：显示 Agent 名称 + "New" 状态，Thread 下拉显示 "New Thread"（不可点击）。

**右侧（Agent 欢迎卡片 + 输入框）**：

```
div.flex-1.flex.flex-col.items-center.justify-center.h-full.px-6
  └── div.text-center.max-w-[480px]
      ├── div[Agent 头像].w-16.h-16.rounded-xl.bg-surface-container-low
      │   .flex.items-center.justify-center.border.border-border-cream.mx-auto.mb-4
      │   └── span.material-symbols-outlined text-[32px] text-charcoal {agent.icon}
      │
      ├── h2[Agent 名称].font-serif.text-[28px].text-charcoal.leading-tight.mb-1
      ├── p[Agent 描述].text-sm.text-stone.leading-relaxed.mb-8
      │   {agent.description || 'Ready to collaborate with you.'}
      │
      ├── p.text-[12px].text-stone.font-semibold.mb-3 "Try asking:"
      │
      └── div.flex.flex-wrap.gap-2.justify-center
          ├── button.suggested-prompt
          │   .px-4.py-2.rounded-full.border.border-border-cream
          │   .text-sm.text-charcoal.hover:bg-surface-container-highest
          │   .transition-colors "Review this code"
          ├── button.suggested-prompt "Security audit"
          └── button.suggested-prompt "Help me debug"
```

**建议消息来源**：
- 前端硬编码预设模板，根据 `agent.description` 中的关键词匹配
- 关键词映射表（未来可扩展为 `AgentTemplate.suggestedPrompts` 字段）：

| agent.description 包含 | 建议消息 |
|------------------------|---------|
| "code" / "review" | "Review this code", "Security audit" |
| "market" / "analysis" | "Analyze market trends", "Generate a report" |
| "data" / "research" | "Help me research this topic", "Summarize these findings" |
| 默认（无匹配） | "Help me get started", "What can you do?" |

**交互流程**：
1. 用户点击建议消息 或 直接在 ChatInput 输入
2. 调用 `createThread(agentId)` → 拿到 `threadId`
3. 调用 `sendThreadMessage(agentId, threadId, content)` → SSE 流式返回
4. 界面从 B1 欢迎卡片过渡到正常聊天视图

**ChatInput 状态**：可用（非 disabled），因为 `activeThread` 为 null 但输入框仍需显示。
→ **实现要点**：B1 场景下 ChatInput 始终可见，发送时先 createThread 再 sendMessage。

**测试用例**：
1. 点击从未对话过的 Agent → 看到 Agent 介绍卡 + 建议消息
2. 点击建议消息 → 创建 Thread + 发送消息 + 进入聊天
3. 在输入框输入内容并发送 → 同上
4. 刷新页面 → Thread 已持久化，进入正常聊天视图

---

### B2: Agent 被停用 / 删除

#### B2a: Agent 被停用 (isActive=false)

**触发条件**：在 Agents 页面停用某个 Agent

**左侧栏**：
- Agent 条目保留（因为加载所有 Agent，含 inactive）
- 条目样式：`opacity-60`
- 右侧显示标签：
  ```
  span.text-[9px].font-semibold.text-stone.bg-surface-container
    .px-1.5.py-0.5.rounded.uppercase "Inactive"
  ```

**顶栏**：正常显示 Agent 名称 + "Inactive" 标签

**右侧**：
- 历史消息只读可见（正常渲染已有消息）
- ChatInput **disabled**：灰色，placeholder 变为 "This AI Employee is currently inactive"
- 输入框上方显示横幅：
  ```
  div.w-full.px-4.py-2.bg-surface-container.border-b.border-surface-container-highest
    .flex.items-center.gap-2.text-sm.text-stone
    ├── span.material-symbols-outlined "pause_circle" text-[18px]
    └── span "This AI Employee is currently inactive"
  ```

**Thread 切换**：可以切换查看历史 Thread（只读），但不能创建新 Thread。

**测试用例**：
1. 停用 Agent → Collaborate 左侧栏该 Agent 灰显 + Inactive 标签
2. 点击停用的 Agent → 消息只读，输入框禁用
3. 切换到其他活跃 Agent → 正常可用

#### B2b: Agent 被删除

**触发条件**：在 Agents 页面删除某个 Agent

**检测机制**（无 WebSocket 推送）：
1. 用户在 Collaborate 左侧栏点击该 Agent → `listAgents` 返回列表中无该 Agent → 刷新左侧栏
2. 发送消息时后端返回 404 → 触发 `listAgents` 刷新 → 切换 Agent
3. Thread 轮询（5s）返回 404 → 触发 `listAgents` 刷新

**行为**：
- 左侧栏：Agent 条目消失（下一次 `listAgents` 调用后）
- 若当前正在查看被删除的 Agent：
  - 顶部显示横幅：
    ```
    div.px-4.py-2.bg-red-50.border-b.border-red-200
      .flex.items-center.gap-2.text-sm.text-red-700
      ├── span.material-symbols-outlined "error" text-[18px]
      └── span "AI Employee has been removed"
    ```
  - 自动切换到下一个可用 Agent：`navigate('/collaborate/:nextAgentId', { replace: true })`
  - 若无其他 Agent → 回到 B0

**测试用例**：
1. 在 Collaborate 中查看 Agent-A → 到 Agents 页面删除 Agent-A
2. 回到 Collaborate → 发送消息触发 404 → 横幅显示 + 自动切换到 Agent-B
3. 删除最后一个 Agent → 回到 B0

---

### B3: Agent 运行中状态冲突

**触发条件**：Agent 正在处理消息（status=running）

| 操作 | 行为 | 实现细节 |
|------|------|---------|
| 发送新消息 | **禁止** | ChatInput `disabled={isStreaming \|\| activeThread?.status === 'running'}` |
| 输入框状态 | 显示 "Agent is thinking..." + 计时器 | placeholder 文字动态切换 |
| 切换同 Agent 其他 Thread | **允许** | ThreadDropdown 正常工作 |
| 切换其他 Agent | **允许** | 后台继续运行，useChatMessages 按 threadId 隔离 |
| 关闭/刷新页面 | SSE 断线 | 结果保留在 sessions 表，重连后恢复 |

**计时器显示**：
```
span.text-[11px].text-stone
  {status === 'running' ? `Thinking... ${elapsedSeconds}s` : statusText}
```
实现：`useEffect` + `setInterval` 每 1s 更新，从最后一条 assistant 消息的创建时间开始计时。

**前后端状态不一致处理**（SSE 断线重连后）：

```
重新进入页面 或 SSE 断线重连
  → GET /agents/:agentId/threads/:threadId
  → 检查 status
  → if 后端 status=running 但前端以为已完成
    → 重新进入 streaming 状态，禁用输入框
    → 追加 "Agent is still working..." 提示
  → if 后端 status=idle 但前端以为还在 running
    → 解除禁用，显示最终结果
    → setIsStreaming(false)
```

**测试用例**：
1. 发送消息 → 输入框禁用，显示 "Thinking... 3s"
2. 切换到其他 Agent → 回来 → 仍在运行，计时器继续
3. 刷新页面 → 重连后恢复 streaming 状态或显示最终结果

---

### B4: 从其他入口跳转

| 入口 | 期望行为 | URL | 右侧显示 |
|------|---------|-----|---------|
| PrimarySidebar "Collaborate" 图标 | 有历史 → 最近活跃 Agent；无历史 → 第一个 Agent | `/collaborate/:firstAgentId` | 最新 Thread 或 B1 |
| Agents 页面 "Start Collaborate" | navigate `/collaborate/:agentId`，带 `state.threadId` | `/collaborate/:agentId` | 指定 Thread |
| Agents 页面 "Start Collaborate"（无 Thread） | navigate `/collaborate/:agentId` | `/collaborate/:agentId` | B1 |
| 直接 URL `/collaborate/:agentId` | Agent 存在 → 加载；不存在 → B0 | `/collaborate/:agentId` 或 `/collaborate` | 对应状态 |
| 直接 URL `/collaborate` | 选第一个 Agent（按 updatedAt 排序） | `/collaborate/:firstAgentId` `replace: true` | 对应状态 |
| 删除 Agent 后留在 Collaborate | 切到下一个 Agent；无 → B0 | `/collaborate/:nextId` 或 `/collaborate` | 对应状态 |

**入口跳转实现逻辑**：

```typescript
// Collaborate 组件初始化逻辑
useEffect(() => {
  // 1. 加载所有 Agent（含 inactive）
  listAgents({ include: 'thread_summary' })
    .then(res => {
      setAgents(res.data);

      if (res.data.length === 0) {
        // B0: 零 Agent
        return;
      }

      if (agentId) {
        // URL 有 agentId → 验证存在性
        const exists = res.data.some(a => a.id === agentId);
        if (!exists) {
          // Agent 不存在 → 重定向到第一个
          navigate(`/collaborate/${res.data[0].id}`, { replace: true });
        }
        // 存在 → useThreads 自动加载
      } else {
        // URL 无 agentId → 自动选第一个（按 updatedAt 降序）
        const sorted = [...res.data].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        navigate(`/collaborate/${sorted[0].id}`, { replace: true });
      }
    });
}, []);
```

**测试用例**：
1. 点击 PrimarySidebar "Collaborate" → 自动选第一个 Agent
2. 从 Agents 页面 "Start Collaborate" → 正确加载指定 Agent
3. 直接访问 `/collaborate/nonexistent-id` → 重定向到第一个 Agent
4. 直接访问 `/collaborate`（有 Agent）→ 自动选第一个 + URL 变为 `/collaborate/:id`

---

### B5: Loading 与错误状态

| 状态 | 区域 | 表现 | CSS |
|------|------|------|-----|
| Agent 列表加载中 | 左侧栏 | spinner + "Loading..." | `div.flex.items-center.justify-center.h-32` → spinner `w-6 h-6 border-2 border-stone/30 border-t-charcoal rounded-full animate-spin` |
| Agent 列表加载中 | 右侧 | 空白（等待左侧栏完成） | `div.flex-1.flex.items-center.justify-center` → 空白 |
| Agent 列表加载失败 | 左侧栏 | "Failed to load" + 重试按钮 | `div.flex.flex-col.items-center.justify-center.h-32.gap-3` → button "Retry" |
| Agent 列表加载失败 | 右侧 | 空白 | 同上 |
| Thread 列表加载中 | 右侧消息区 | spinner | `div.flex.items-center.justify-center.h-full` → spinner |
| Thread 列表为空 | 右侧 | B1 欢迎卡片 | 见 B1 |
| 消息发送失败 | 输入框上方 | 红色错误提示 + 重试 | `div.px-4.py-2.bg-red-50.border-b.border-red-200.text-sm.text-red-700` + retry button |
| SSE 连接错误 | 消息区 | assistant 消息块内显示错误 | 已在 useChatMessages onError 中处理 |
| API 401 | 全局 | 跳转 `/login` | 由 `handleUnauthorized` 处理 |
| API 500 | 全局 | toast 提示 "Something went wrong" | 使用 window.alert 或 toast 组件 |

**错误恢复**：

```
listAgents 失败
  → 显示重试按钮
  → 用户点击重试 → 重新调用 listAgents
  → 成功 → 正常显示
  → 再次失败 → 仍显示重试按钮

sendThreadMessage 失败 (网络错误)
  → 输入框上方红色横幅 "Failed to send message"
  → 横幅右侧 "Retry" 按钮
  → 用户点击 Retry → 重新发送
  → setIsStreaming(false) 解除输入框禁用

listThreads 失败
  → console.error 记录
  → threads 列表显示空状态
  → 下次轮询 (5s) 自动重试
```

**测试用例**：
1. 后端未启动 → 访问 `/collaborate` → 左侧栏 "Failed to load" + 重试按钮
2. 发送消息时断网 → 红色错误横幅 + 重试按钮
3. Token 过期 → 跳转 `/login`

---

### B6: 搜索过滤

**触发条件**：用户在左侧栏搜索框输入文字

**实现**：
```typescript
const [searchQuery, setSearchQuery] = useState('');
const [debouncedQuery, setDebouncedQuery] = useState('');

// 300ms debounce
useEffect(() => {
  const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
  return () => clearTimeout(timer);
}, [searchQuery]);

const filteredAgents = agents.filter(a =>
  a.name.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
  (a.description?.toLowerCase() ?? '').includes(debouncedQuery.toLowerCase())
);
```

**搜索无结果**：
```
div.flex.items-center.justify-center.h-32
  └── span.text-[11px].text-stone "No matching agents"
```

**测试用例**：
1. 输入 "code" → 只显示名称或描述包含 "code" 的 Agent
2. 清空搜索 → 恢复全部 Agent
3. 输入无匹配关键词 → 显示 "No matching agents"

---

## 7. 后端 API 变更

### 7.1 扩展 listAgents 返回值

**端点**：`GET /api/v1/agents`

**新增查询参数**：`include=thread_summary`

**返回值扩展**：每个 Agent 对象增加 `threadSummary` 字段：

```typescript
interface AgentWithSummary extends AgentTemplate {
  threadSummary?: {
    totalThreads: number;
    latestStatus: 'running' | 'idle' | 'completed' | 'error' | null;
    latestThreadTitle: string | null;
    lastActiveAt: string | null;
  };
}
```

**SQL 实现**（在 `server/src/services/agent-template.ts` 中新增 `listWithThreadSummary`）：

```sql
SELECT
  at.*,
  (
    SELECT json_build_object(
      'totalThreads', count(*),
      'latestStatus', (SELECT s.status FROM sessions s WHERE s.template_id = at.id ORDER BY s.last_active_at DESC NULLS LAST LIMIT 1),
      'latestThreadTitle', (SELECT s.title FROM sessions s WHERE s.template_id = at.id ORDER BY s.last_active_at DESC NULLS LAST LIMIT 1),
      'lastActiveAt', (SELECT s.last_active_at FROM sessions s WHERE s.template_id = at.id ORDER BY s.last_active_at DESC NULLS LAST LIMIT 1)
    )
    FROM sessions s WHERE s.template_id = at.id AND s.user_id = $userId
  ) as "threadSummary"
FROM agent_templates at
WHERE at.tenant_id = $tenantId
ORDER BY at.updated_at DESC
```

**后端路由变更**（`server/src/routes/agents.ts`）：
- 解析 `include` 查询参数
- 如果 `include` 包含 `'thread_summary'`，调用 `listWithThreadSummary`
- 否则调用现有 `listAgents`

**重要**：不再传递 `{ active: true }` 过滤。Collaborate 页面需要加载**所有 Agent**（含 inactive），由前端控制灰显。

### 7.2 排序

`GET /api/v1/agents` 默认按 `updated_at DESC` 排列（最近更新的 Agent 在前）。

### 7.3 前端 API 变更

**`web/src/api/agents.ts`**：
```typescript
export async function listAgents(params?: {
  active?: boolean;
  include?: 'thread_summary';
  limit?: number;
  offset?: number;
}): Promise<ListAgentsResponse<AgentWithSummary>> {
  // ... 新增 include 参数
  if (params?.include) searchParams.set('include', params.include);
  // ...
}
```

---

## 8. 数据流

### 8.1 初始化流程

```
页面加载 (/collaborate 或 /collaborate/:agentId)
  │
  ├─→ listAgents({ include: 'thread_summary' })
  │     ├─→ agents.length === 0 → 显示 B0，结束
  │     ├─→ URL 有 agentId && agentId 在 agents 中 → 继续
  │     ├─→ URL 有 agentId && agentId 不在 agents 中 → navigate(/collaborate/:firstId, replace)
  │     └─→ URL 无 agentId → navigate(/collaborate/:firstId, replace)
  │
  └─→ useThreads(agentId) 自动触发
        ├─→ listThreads(agentId)
        │     ├─→ threads.length > 0 → 自动选第一个 (activeThreadId = threads[0].id)
        │     └─→ threads.length === 0 → activeThreadId = null → 显示 B1
        │
        └─→ activeThreadId 有值
              └─→ loadHistory(agentId, activeThreadId)
                    → 渲染消息列表
```

### 8.2 Agent 切换

```
用户点击左侧栏 Agent 条目
  → navigate(/collaborate/:newAgentId)
  → agentId 变化 → useThreads 重新加载
  → agents.find(a => a.id === newAgentId) → 新的 activeAgent
  → activeThreadId 重置 → useEffect 触发 loadThreads
  → 根据 threads 数量显示对应状态
```

### 8.3 Thread 切换

```
用户点击 ThreadDropdown 中的 Thread
  → switchThread(newThreadId)
  → activeThreadId 更新
  → loadHistory(agentId, newThreadId) (如果该 Thread 无缓存消息)
  → 渲染对应 Thread 的消息

用户点击 "New Thread"
  → createNewThread()
  → createThread(agentId) API 调用
  → setThreads(prev => [newThread, ...prev])
  → setActiveThreadId(newThread.id)
  → activeThreadId = newThread.id → 消息区显示空 → 显示 B1 欢迎卡片
```

### 8.4 首次发消息（B1 → 正常聊天）

```
用户在 B1 状态下输入第一条消息
  → handleSend(content)
    → if (!activeThreadId)
      → thread = await createThread(agentId)
      → setActiveThreadId(thread.id)
    → sendMessage(agentId, thread.id, content)
      → sendThreadMessage(agentId, threadId, content, callbacks)
      → SSE 开始流式返回
      → 消息区从欢迎卡片过渡到正常聊天
```

---

## 9. 组件清单

### 9.1 新增组件

| 组件 | 文件路径 | Props | 用途 |
|------|---------|-------|------|
| `EmptyCollaborateView` | `web/src/components/collaborate/EmptyCollaborateView.tsx` | 无 props | B0 零 Agent 引导卡片 |
| `AgentWelcomeView` | `web/src/components/collaborate/AgentWelcomeView.tsx` | `{ agent: AgentTemplate; onSuggestedPrompt: (text: string) => void }` | B1 Agent 介绍 + 建议消息 |
| `AgentInactiveBanner` | `web/src/components/collaborate/AgentInactiveBanner.tsx` | 无 props | B2a 停用状态横幅 |
| `AgentRemovedBanner` | `web/src/components/collaborate/AgentRemovedBanner.tsx` | `{ onDismiss: () => void }` | B2b 删除状态横幅 |
| `ThreadDropdown` | `web/src/components/collaborate/ThreadDropdown.tsx` | `{ threads: Thread[]; activeThreadId: string \| null; onSelect: (id: string) => void; onCreateNew: () => void; loading: boolean }` | 顶栏 Thread 切换下拉 |

### 9.2 复用组件

| 组件 | 文件 | 变更 |
|------|------|------|
| `UserMessage` | `components/chat/UserMessage.tsx` | 无变更 |
| `AssistantMessage` | `components/chat/AssistantMessage.tsx` | 无变更 |
| `ThinkingBlock` | `components/chat/ThinkingBlock.tsx` | 无变更 |
| `TextBlock` | `components/chat/TextBlock.tsx` | 无变更 |
| `ToolUseBlock` | `components/chat/ToolUseBlock.tsx` | 无变更 |
| `ArtifactBlock` | `components/chat/ArtifactBlock.tsx` | 无变更 |
| `ChatInput` | `components/chat/ChatInput.tsx` | 无变更 |
| `ArtifactPanel` | `components/artifact/ArtifactPanel.tsx` | 无变更 |
| `TaskBar` | `components/task/TaskBar.tsx` | 无变更 |
| `ThreadItem` | `components/thread/ThreadItem.tsx` | 无变更，在 ThreadDropdown 中复用 |
| `useResizableSidebar` | `hooks/useResizableSidebar.ts` | 无变更 |
| `useThreads` | `hooks/useThreads.ts` | 无变更 |
| `useChatMessages` | `hooks/useChatMessages.ts` | 无变更 |

### 9.3 修改组件

| 组件 | 文件 | 变更内容 |
|------|------|---------|
| `Collaborate` | `pages/Collaborate.tsx` | 整合左侧 Agent 列表 + 状态点；移除 Thread 覆盖面板，改顶栏 ThreadDropdown；加载所有 Agent（含 inactive）；接入搜索过滤；处理 B0/B1/B2 边界状态 |
| `App` | `App.tsx` | 移除 CollaborateLanding 路由和 import |
| `api/agents` | `api/agents.ts` | listAgents 增加 `include` 参数；ListAgentsResponse 支持泛型 |
| `server/routes/agents` | `server/src/routes/agents.ts` | 支持 `include=thread_summary` 查询参数 |
| `server/services/agent-template` | `server/src/services/agent-template.ts` | 新增 `listWithThreadSummary` 方法 |

### 9.4 移除文件

| 文件 | 说明 |
|------|------|
| `web/src/pages/CollaborateLanding.tsx` | 合并入 Collaborate |
| `web/src/components/thread/ThreadList.tsx` | 内联到 ThreadDropdown |
| `web/src/api/collaborations.ts` | 不再需要 |
| `server/src/routes/collaborations.ts` | 不再需要 |

---

## 10. 实现阶段建议

### Phase 1: 后端 API 扩展
1. `server/src/services/agent-template.ts` — 新增 `listWithThreadSummary` 方法
2. `server/src/routes/agents.ts` — 支持 `include=thread_summary` 参数
3. 测试：验证 `GET /api/v1/agents?include=thread_summary` 返回正确的 `threadSummary`

### Phase 2: 前端 API + 类型
1. `web/src/api/agents.ts` — listAgents 增加 `include` 参数
2. `web/src/types/chat.ts` — 新增 `AgentWithSummary` 类型

### Phase 3: 新增组件
1. `EmptyCollaborateView` — B0 引导卡片
2. `AgentWelcomeView` — B1 欢迎卡片
3. `AgentInactiveBanner` — B2a 横幅
4. `AgentRemovedBanner` — B2b 横幅
5. `ThreadDropdown` — 顶栏 Thread 切换

### Phase 4: 主页面重构
1. `Collaborate.tsx` — 整合所有变更
2. `App.tsx` — 移除 CollaborateLanding 路由

### Phase 5: 清理
1. 删除 `CollaborateLanding.tsx`
2. 删除 `api/collaborations.ts`
3. 删除 `server/src/routes/collaborations.ts`（如果无其他引用）

---

## 11. 不做的事

- 不在 Collaborate 页面内创建 Agent（Agents 页面职责）
- 不做移动端响应式（只考虑桌面端）
- 不做消息搜索（未来 feature）
- 不做 Thread 重命名（未来 feature）
- 不做 Agent 列表的 WebSocket 实时推送（依赖轮询 5s + 操作触发刷新）
- 不做 `suggestedPrompts` 后端字段（前端硬编码，未来可扩展）
- 不做 Thread 删除功能（未来 feature）
- 不修改 PrimarySidebar 组件（当前逻辑已正确）
