# Threads 系统设计

> 日期：2026-05-05
> 状态：已确认
> 范围：骨架优先（第一期）

---

## 背景与目标

Neptune-AI 的产品第一用户是 Agent。一个 Agent 代表现实生活中的一个人（如财务、HR、行政）。用户可以在多个渠道给 Agent 派活，每个活就是一个 Thread。

**核心概念**：

```
Agent（"财务助手"）
├── Thread A — "处理 Q3 报表"    [running]
├── Thread B — "审批报销单"      [idle]
└── Thread C — "月度汇总"        [completed]
```

**本期能力**：
- 一个 Agent 下支持多个 Thread（多 Engine Session 并发）
- Thread 自动创建（用户发消息时）
- Thread 列表展示 + 切换
- 4 状态模型：running / idle / completed / error

**后续迭代**：
- Thread 阻塞/等待用户审核通知
- 多渠道派活
- Thread 状态实时推送（WebSocket）

---

## 数据库 Schema 变更

### sessions 表改造

`sessions` 表新增字段，升级为 Thread 概念：

```sql
ALTER TABLE sessions ADD COLUMN title TEXT;
ALTER TABLE sessions ADD COLUMN summary TEXT;
```

完整字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | text PK | Session/Thread ID（与 SDK SessionId 一致） |
| tenantId | uuid FK → tenants.id | 租户 |
| userId | uuid FK → users.id | 用户 |
| templateId | uuid FK → agent_templates.id | Agent 模板 |
| title | text | Thread 标题（可为空，自动从首条消息生成） |
| summary | text | 最新摘要（Agent 最近活动描述，列表预览用） |
| status | text | `running` / `idle` / `completed` / `error` |
| workspace | text | 文件系统工作目录 |
| lastActiveAt | timestamp | 最后活跃时间（排序 + 默认进入用） |
| createdAt | timestamp | 创建时间 |
| updatedAt | timestamp | 更新时间 |

**关键变化**：
1. 去掉"每用户+Agent 只有一个 Session"的限制，允许一个 Agent 下有多个 Thread
2. status 简化为 4 种：`running`（正在执行）、`idle`（空闲等待）、`completed`（已完成）、`error`（出错）
3. `title` 和 `summary` 支持 Thread 列表展示

**不需要 `is_main` 或 `is_current` 字段**：默认进入的 Thread 由 `lastActiveAt` 排序决定（最新的即为默认），当前查看的 Thread 是纯前端 UI 状态。

### Migration 文件

需要生成新的 Drizzle migration：
- 添加 `title` 列（nullable text）
- 添加 `summary` 列（nullable text）
- 更新现有记录的 status（`active` → `idle`，`created` → `idle`，`paused` → `idle`，`terminated` → `completed`）

---

## 后端架构

### ThreadManager（取代 QueryDispatcher 核心逻辑）

**现有问题**：
- `QueryDispatcher` 每 query 创建/销毁 Engine，无状态
- `getOrCreateSession()` 限制每用户+Agent 只有一个 Session

**新设计**：`ThreadManager` 管理 Thread 生命周期和 Engine 实例池。

```
用户发消息 → ThreadManager.dispatch(threadId, content)
  → 1. 查找 Thread 记录
  → 2. 从 Engine Pool 获取该 Thread 的 Engine 实例
  → 3. Engine 存在 → 直接 query()
     Engine 不存在 → 创建新 Engine，加载/创建 SDK Session，query()
  → 4. 返回 SSE 流
  → 5. 流结束后 Engine 不销毁（保持 alive 供后续消息）
  → 6. 更新 Thread 的 lastActiveAt、summary
```

### Engine Pool 管理

```typescript
class EnginePool {
  private engines: Map<string, AgentEngine> = new Map();
  private maxConcurrent: number;

  // 获取或创建 Engine
  async getOrCreate(threadId: string, config: EngineConfig): Promise<AgentEngine>;

  // 释放 Engine（Thread idle 超时或超出并发限制）
  async release(threadId: string): Promise<void>;

  // 获取当前活跃 Engine 数
  getActiveCount(): number;
}
```

**策略**：
- 最大并发数由 Agent 模板的 `constraints.maxConcurrentSessions` 控制
- 超出并发限制时，将最久没活动的 Engine 对应 Thread 标记为 `idle`，释放 Engine
- Engine idle 超时（30 分钟）自动回收
- Engine 被回收后 Thread 状态保持 `idle`，下次发消息时重新创建 Engine 并加载 SDK Session

### Thread 生命周期

```
创建（用户发消息，无指定 threadId）
  → status: running
  → Engine 创建，开始执行

执行中（SSE 流式输出）
  → status: running
  → 更新 summary

流结束
  → status: idle（等待下一条消息）
  → 更新 lastActiveAt、summary

用户再次发消息到同一 Thread
  → status: running
  → 复用 Engine 实例

Thread 完成（用户主动关闭或 Agent 表示任务完成）
  → status: completed
  → 释放 Engine

出错
  → status: error
  → 释放 Engine
```

### ThreadManager 核心方法

```typescript
class ThreadManager {
  // 创建新 Thread
  async create(params: CreateThreadParams): Promise<Thread>;

  // 获取 Agent 下的 Thread 列表
  async list(agentId: string, userId: string): Promise<Thread[]>;

  // 获取 Thread 详情
  async get(threadId: string): Promise<Thread | null>;

  // 向 Thread 发消息（核心方法）
  async *dispatch(threadId: string, content: string): AsyncGenerator<QueryEvent>;

  // 自动创建或获取最近 Thread 并发消息（兼容旧接口）
  async *dispatchToAgent(agentId: string, userId: string, tenantId: string, content: string): AsyncGenerator<QueryEvent>;

  // 更新 Thread
  async update(threadId: string, data: UpdateThreadParams): Promise<Thread | null>;

  // 删除 Thread
  async delete(threadId: string): Promise<boolean>;
}
```

---

## API 设计

### Thread CRUD

#### GET /api/v1/agents/:agentId/threads

获取该 Agent 下当前用户的所有 Thread，按 `lastActiveAt` 降序排列。

**认证**：Bearer Token

**Query 参数**：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| limit | integer | 50 | 每页数量 |
| offset | integer | 0 | 偏移量 |
| status | string | - | 按状态过滤 |

**响应 200**：

```json
{
  "data": [
    {
      "id": "session-id-1",
      "agentId": "agent-uuid",
      "title": "处理 Q3 报表",
      "summary": "正在分析销售数据...",
      "status": "running",
      "lastActiveAt": "2026-05-05T10:30:00.000Z",
      "createdAt": "2026-05-05T10:00:00.000Z"
    },
    {
      "id": "session-id-2",
      "agentId": "agent-uuid",
      "title": "审批报销单",
      "summary": "已完成审核",
      "status": "idle",
      "lastActiveAt": "2026-05-05T09:00:00.000Z",
      "createdAt": "2026-05-05T08:00:00.000Z"
    }
  ],
  "meta": {
    "count": 2,
    "limit": 50,
    "offset": 0
  }
}
```

#### POST /api/v1/agents/:agentId/threads

创建新 Thread。

**Body**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| title | string | 否 | Thread 标题（不提供则用首条消息自动生成） |

```json
{
  "title": "处理 Q3 报表"
}
```

**响应 201**：

```json
{
  "id": "new-session-id",
  "agentId": "agent-uuid",
  "title": "处理 Q3 报表",
  "summary": null,
  "status": "idle",
  "lastActiveAt": "2026-05-05T10:30:00.000Z",
  "createdAt": "2026-05-05T10:30:00.000Z"
}
```

#### GET /api/v1/agents/:agentId/threads/:threadId

获取 Thread 详情。

**响应 200**：返回完整 Thread 对象（同上）。

#### PATCH /api/v1/agents/:agentId/threads/:threadId

更新 Thread（标题、状态）。

**Body**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| title | string | 否 | 新标题 |
| status | string | 否 | 强制变更状态（如 `completed`） |

#### DELETE /api/v1/agents/:agentId/threads/:threadId

删除 Thread。同时释放关联的 Engine 实例。

**响应 204**：无响应体。

### Thread 对话

#### POST /api/v1/agents/:agentId/threads/:threadId/chat

向指定 Thread 发消息，返回 SSE 流。这是核心对话接口。

**Body**：

```json
{
  "content": "帮我分析一下 Q3 的销售数据"
}
```

**SSE 响应**：与现有 `/agents/:agentId/chat` 一致（connected / message / done / error）。

**行为**：
- 如果 Thread 状态为 `idle`，重新创建/加载 Engine 执行
- 如果 Thread 状态为 `running`（另一个请求正在执行），返回 409 Conflict
- 如果 Thread 状态为 `completed` 或 `error`，返回 400 Bad Request（已完成/出错的 Thread 不能继续）

#### POST /api/v1/agents/:agentId/chat

**兼容旧接口**。不指定 threadId 时：
1. 查找该用户+Agent 下最新的 `idle` 状态 Thread
2. 找到 → 向该 Thread 发消息
3. 未找到 → 创建新 Thread 并发消息

这样前端不需要先调用 Thread 创建接口，可以直接用这个接口开始对话。

#### GET /api/v1/agents/:agentId/threads/:threadId/history

获取指定 Thread 的对话历史。与现有 `/agents/:agentId/history` 逻辑一致，但指定了 Thread。

### 原有接口兼容

| 原接口 | 新行为 |
|--------|--------|
| `POST /agents/:agentId/chat` | 自动创建/复用最近 Thread（兼容） |
| `GET /agents/:agentId/history` | 读取最近 Thread 的历史（兼容） |

---

## 前端改造

### 页面结构变化

**Collaborate 页面**：

```
┌────────────────────────────────────────────────────────┐
│ PrimarySidebar │ Thread 列表 │     对话区      │ Canvas │
│                │ (可调宽度)  │                │        │
│   N            │             │                │        │
│   Home         │ ● Q3报表    │  Thread 对话    │        │
│   Agents       │   running   │                │        │
│   Skills       │ ○ 报销审批   │  [TaskBar]     │        │
│   Collab       │   idle      │                │        │
│                │ ✓ 月度汇总   │  [输入框]      │        │
│                │   completed │                │        │
│                │             │                │        │
│                │ [+ New]     │                │        │
└────────────────────────────────────────────────────────┘
```

### 组件改造清单

| 组件 | 改造内容 |
|------|----------|
| `Collaborate.tsx` | 左侧栏从 Agent 列表变为 Thread 列表；通过 API 加载 Thread 数据 |
| `useChatMessages.ts` | 改为 per-thread 管理消息；发送消息调用 `POST /threads/:id/chat`；移除 Mock 改为真实 SSE |
| `TaskBar.tsx` | 改为 per-thread 展示（已经是了，只需传入正确的 threadId） |
| `TaskPanel.tsx` | 同上 |
| 新增 `ThreadList.tsx` | Thread 列表组件：展示标题、状态指示器、摘要、时间 |
| 新增 `useThreads.ts` | Thread 列表 hook：加载、切换、创建 |

### 类型变更

```typescript
// types/chat.ts 新增
export interface Thread {
  id: string;
  agentId: string;
  title: string | null;
  summary: string | null;
  status: 'running' | 'idle' | 'completed' | 'error';
  lastActiveAt: string;
  createdAt: string;
}
```

### 路由变更

```typescript
// App.tsx
<Route path="/collaborate/:agentId" element={<Collaborate />} />
// agentId 必填，不再可选
// Thread 切换在前端组件内完成，不反映在 URL 中（简化路由）
```

### 数据流

```
1. 进入 /collaborate/:agentId
   → GET /agents/:agentId/threads
   → 按 lastActiveAt 排序，默认选中第一个
   → GET /agents/:agentId/threads/:threadId/history 加载历史

2. 用户发消息
   → POST /agents/:agentId/threads/:threadId/chat (SSE)
   → 实时更新消息列表
   → 流结束后刷新 Thread 列表（更新 summary/status）

3. 切换 Thread
   → 前端切换 threadId
   → GET /agents/:agentId/threads/:newThreadId/history
   → 重新渲染对话区

4. 创建新 Thread
   → POST /agents/:agentId/threads
   → 或直接 POST /agents/:agentId/chat（自动创建）
   → 切换到新 Thread

5. 定时刷新 Thread 列表
   → 每 5s 轮询 GET /agents/:agentId/threads
   → 更新状态指示器（running 动画、error 标记等）
```

---

## 实施顺序

1. **后端 DB migration**：sessions 表新增 title、summary 字段，迁移现有 status
2. **后端 ThreadManager**：实现 Engine Pool + Thread CRUD + dispatch
3. **后端 API 路由**：新增 Thread 路由，修改现有 chat/history 路由
4. **后端测试**：Thread CRUD 测试 + 多 Thread 并发测试
5. **前端类型和 API 客户端**：新增 Thread 类型、API 调用函数
6. **前端 ThreadList 组件**：Thread 列表 UI
7. **前端 Collaborate 改造**：集成 ThreadList，改造 useChatMessages 接入真实 API
8. **前端 SSE 集成**：对接真实后端 SSE 流
9. **端到端联调**：前后端打通完整流程
