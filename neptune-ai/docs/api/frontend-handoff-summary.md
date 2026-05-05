# 前端对接摘要 — 后端 API 改造完成

> 日期: 2026-05-05
> 范围: SSE 事件格式、History API、Agent icon 字段

---

## 改造概要

后端已完成前端 API 诉求文档（`docs/api/frontend-sse-history-requirements.md`）中的全部三项改造。

| 诉求 | 优先级 | 状态 | 改造内容 |
|------|--------|------|----------|
| SSE 事件类型对齐 | P0 | 已完成 | 新增事件映射层，SDK → 前端格式转换 |
| History 返回 blocks 结构 | P1 | 已完成 | 新增历史转换层，transcript.jsonl → 结构化 blocks |
| Agent icon 字段 | P2 | 已完成 | schema 新增 icon 列，API 自动返回 |

---

## 一、SSE 事件格式变更

### 传输格式

统一使用 **方案 A**（`event: message` + `data.type` 区分）：

```
event: message
data: {"type":"text","content":"正在分析..."}

event: message
data: {"type":"tool_use","id":"tool-1","name":"read_file","input":{...},"status":"running"}

event: message
data: {"type":"tool_result","toolUseId":"tool-1","output":{...}}

event: message
data: {"type":"tool_status","id":"tool-1","status":"completed"}

event: done
data: {"usage":{"inputTokens":150,"outputTokens":500}}
```

### 事件类型完整列表

| data.type | 触发时机 | data 结构 |
|-----------|---------|-----------|
| `text` | Agent 输出文字 | `{ type: "text", content: string }` |
| `tool_use` | 工具调用开始 | `{ type: "tool_use", id: string, name: string, input: object, status: "running" }` |
| `tool_result` | 工具返回结果 | `{ type: "tool_result", toolUseId: string, output: unknown }` |
| `tool_status` | 工具状态变更 | `{ type: "tool_status", id: string, status: "completed" \| "error" }` |
| `error` | 执行出错 | `{ type: "error", message: string }` |

### 映射规则

| SDK 原始类型 | → 前端类型 | 说明 |
|-------------|-----------|------|
| `assistant` | `text` | 重命名 type |
| `tool_use` | `tool_use` | 透传，加 `status: "running"` |
| `tool_result` | `tool_result` + `tool_status` | 一个 SDK 事件映射为两个前端事件 |
| `system` | （静默丢弃） | 不发给前端 |
| `error` / `assistant_error` | `error` | 提取错误信息 |

### 不支持的事件

以下事件类型当前 SDK 不产出，前端需处理缺失场景：
- `thinking` — Claude extended thinking 功能，需 SDK 后续支持
- `artifact` — 需后端业务层实现
- `plan_task` / `plan_task_update` — 需后端业务层实现
- `bg_task` / `bg_task_update` — 需后端业务层实现

### 影响范围

- `POST /api/v1/agents/:agentId/threads/:threadId/chat` — Thread 对话 SSE
- `POST /api/v1/agents/:agentId/chat` — 旧 Sessions 对话 SSE（已同步改造）

前端 `sendThreadMessage` 已支持此格式，**无需修改**。

---

## 二、History API 变更

### 返回格式

从原始 JSONL 格式变更为结构化 `blocks` 格式：

```json
{
  "data": [
    {
      "id": "msg-uuid-1",
      "role": "user",
      "blocks": [
        { "type": "text", "content": "帮我分析销售数据" }
      ],
      "status": "complete"
    },
    {
      "id": "msg-uuid-2",
      "role": "assistant",
      "blocks": [
        { "type": "text", "content": "正在分析..." },
        { "type": "tool_use", "id": "tool-1", "name": "read_file", "input": {"path": "sales.csv"}, "status": "completed" },
        { "type": "tool_result", "toolUseId": "tool-1", "output": {"rows": 1000} },
        { "type": "text", "content": "分析完成..." }
      ],
      "status": "complete"
    }
  ],
  "meta": {
    "threadId": "...",
    "agentId": "...",
    "limit": 50,
    "count": 2
  }
}
```

### HistoryMessage 结构

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 消息 UUID |
| role | `"user"` \| `"assistant"` | 角色 |
| blocks | HistoryBlock[] | 结构化内容块 |
| status | `"complete"` | 消息状态 |

### HistoryBlock 类型

| type | 结构 |
|------|------|
| `text` | `{ type: "text", content: string }` |
| `tool_use` | `{ type: "tool_use", id: string, name: string, input?: object, status: "completed" }` |
| `tool_result` | `{ type: "tool_result", toolUseId: string, output?: unknown }` |

### 影响范围

- `GET /api/v1/agents/:agentId/threads/:threadId/history` — Thread 历史
- `GET /api/v1/agents/:agentId/history` — 旧 Sessions 历史（已同步改造）

前端 `loadHistory` 已实现兼容逻辑：有 `blocks` 用 blocks，只有 `content` 则包装为 `[{ type: 'text', content }]`。**无需修改**。

---

## 三、Agent icon 字段

### 变更

`agent_templates` 表新增 `icon` 列：

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| icon | text | `smart_toy` | Material Symbols 图标名 |

### API 影响

- `GET /api/v1/agents` — 响应中每个 Agent 对象包含 `icon` 字段
- `GET /api/v1/agents/:id` — 响应包含 `icon` 字段
- `POST /api/v1/agents` — 请求体支持 `icon`（可选，默认 `smart_toy`）
- `PUT /api/v1/agents/:id` — 可更新 `icon`

### 示例

```json
{
  "id": "uuid",
  "name": "财务助手",
  "icon": "receipt_long",
  "description": "处理财务报表的 AI 助手",
  ...
}
```

### 前端兼容

前端已有过渡方案：如果后端未返回 `icon` 字段，默认使用 `smart_toy`。现在后端已返回此字段，可直接使用。

### Migration

数据库 migration 已生成：`server/src/db/migrations/0001_chemical_the_twelve.sql`

```sql
ALTER TABLE "agent_templates" ADD COLUMN "icon" text DEFAULT 'smart_toy';
```

---

## 四、新增后端文件

| 文件 | 职责 |
|------|------|
| `server/src/services/sse-event-mapper.ts` | SDK QueryEvent → 前端 SSE 事件映射 |
| `server/src/services/history-transformer.ts` | transcript.jsonl → 结构化 blocks 转换 |

两个模块都是纯函数，无副作用，无外部依赖。

---

## 五、前端需要做的

**无需代码改动**。前端 `sendThreadMessage` 和 `loadHistory` 已实现了兼容逻辑，后端现在返回的格式正好是前端期望的格式。

**可选改进**：
- 移除 `loadHistory` 中的 `content` fallback 逻辑（已不需要）
- 如果前端需要 `thinking` / `artifact` / `plan_task` / `bg_task` 事件，需要等产品层定义后再实现

---

## 六、验证方式

```bash
# 启动后端
cd server && docker-compose up -d && bun run db:migrate && bun run dev

# 测试 SSE 格式 — 发送消息后观察 SSE 流
# curl -X POST http://localhost:3000/api/v1/agents/{agentId}/threads/{threadId}/chat \
#   -H "Authorization: Bearer {token}" \
#   -H "Content-Type: application/json" \
#   -d '{"content":"hello"}'

# 测试 History 格式
# curl http://localhost:3000/api/v1/agents/{agentId}/threads/{threadId}/history \
#   -H "Authorization: Bearer {token}"

# 测试 Agent icon
# curl http://localhost:3000/api/v1/agents \
#   -H "Authorization: Bearer {token}"

# 运行后端测试
cd server && bun test
```
