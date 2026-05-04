# Thread 模块 (Threads)

> Thread 是 Sessions 的升级版，提供显式的对话线程管理。每个 Thread 拥有独立的生命周期，支持创建、列表、更新、删除，以及基于 Thread 的 SSE 流式对话。

## 接口总览

| 方法 | 路径 | 认证 | 角色 | 说明 |
|------|------|------|------|------|
| POST | `/api/v1/agents/:agentId/threads` | Bearer | 任意已认证 | 创建 Thread |
| GET | `/api/v1/agents/:agentId/threads` | Bearer | 任意已认证 | 列出 Thread |
| GET | `/api/v1/agents/:agentId/threads/:threadId` | Bearer | 任意已认证 | 获取 Thread 详情 |
| PATCH | `/api/v1/agents/:agentId/threads/:threadId` | Bearer | admin | 更新 Thread |
| DELETE | `/api/v1/agents/:agentId/threads/:threadId` | Bearer | admin | 删除 Thread |
| POST | `/api/v1/agents/:agentId/threads/:threadId/chat` | Bearer | 任意已认证 | 发送消息（SSE） |
| GET | `/api/v1/agents/:agentId/threads/:threadId/history` | Bearer | 任意已认证 | 获取历史记录 |

> Thread 路由注册在 `/api/v1/agents` 前缀下，与 Agent 模板路由共享前缀。
> 更新、删除需要 admin 角色。其他接口只需认证即可。

---

## 数据模型

### Thread

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string (UUID) | Thread 唯一标识 |
| tenantId | string (UUID) | 所属租户 |
| userId | string (UUID) | 所属用户 |
| templateId | string (UUID) | 关联的 Agent 模板 ID |
| status | string | 状态：`idle` / `running` / `completed` / `error` |
| title | string \| null | Thread 标题 |
| summary | string \| null | 最近消息摘要（自动截取前 100 字符） |
| workspace | string | Thread 工作目录路径 |
| lastActiveAt | string (ISO 8601) \| null | 最后活跃时间 |
| createdAt | string (ISO 8601) \| null | 创建时间 |
| updatedAt | string (ISO 8601) \| null | 更新时间 |

### Thread 状态流转

```
idle ──→ running ──→ idle      （正常对话循环）
  │           │
  │           └──→ error       （执行出错）
  │
  └──→ completed               （手动关闭）
```

| 状态 | 说明 |
|------|------|
| `idle` | 空闲，可接受新消息 |
| `running` | 正在执行中，不可发消息 |
| `completed` | 已结束，不可再发消息 |
| `error` | 执行出错，不可再发消息 |

---

## POST /api/v1/agents/:agentId/threads

创建一个新的 Thread。创建后状态为 `idle`。

### 请求

**Path**:

| 参数 | 类型 | 说明 |
|------|------|------|
| agentId | string (UUID) | Agent 模板 ID |

**Body**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| title | string | 否 | Thread 标题 |

```json
{
  "title": "处理 Q3 报表"
}
```

### 响应

**201 Created**:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenantId": "660e8400-e29b-41d4-a716-446655440001",
  "userId": "770e8400-e29b-41d4-a716-446655440002",
  "templateId": "880e8400-e29b-41d4-a716-446655440003",
  "status": "idle",
  "title": "处理 Q3 报表",
  "summary": null,
  "workspace": "/data/tenants/xxx/agents/xxx/users/xxx/threads/xxx/",
  "lastActiveAt": null,
  "createdAt": "2026-05-05T10:00:00.000Z",
  "updatedAt": "2026-05-05T10:00:00.000Z"
}
```

### 错误响应

| 状态码 | error | 触发条件 |
|--------|-------|----------|
| 500 | `INTERNAL_ERROR` | 服务端异常 |

---

## GET /api/v1/agents/:agentId/threads

列出当前用户在指定 Agent 下的 Thread 列表。按 `lastActiveAt` 降序排列。

### 请求

**Path**:

| 参数 | 类型 | 说明 |
|------|------|------|
| agentId | string (UUID) | Agent 模板 ID |

**Query**:

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| status | string | - | 按状态过滤（`idle` / `running` / `completed` / `error`） |
| limit | integer | 50 | 每页数量 |
| offset | integer | 0 | 偏移量 |

```
GET /api/v1/agents/agent-id/threads?status=idle&limit=20&offset=0
```

### 响应

**200 OK**:

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "tenantId": "660e8400-e29b-41d4-a716-446655440001",
      "userId": "770e8400-e29b-41d4-a716-446655440002",
      "templateId": "880e8400-e29b-41d4-a716-446655440003",
      "status": "idle",
      "title": "处理 Q3 报表",
      "summary": "正在分析销售数据...",
      "workspace": "/data/tenants/xxx/agents/xxx/users/xxx/threads/xxx/",
      "lastActiveAt": "2026-05-05T10:30:00.000Z",
      "createdAt": "2026-05-05T10:00:00.000Z",
      "updatedAt": "2026-05-05T10:30:00.000Z"
    }
  ],
  "meta": {
    "count": 1,
    "limit": 20,
    "offset": 0
  }
}
```

### 错误响应

| 状态码 | error | 触发条件 |
|--------|-------|----------|
| 500 | `INTERNAL_ERROR` | 服务端异常 |

---

## GET /api/v1/agents/:agentId/threads/:threadId

获取单个 Thread 的详情。会验证 Thread 归属当前用户的租户和指定的 Agent。

### 请求

**Path**:

| 参数 | 类型 | 说明 |
|------|------|------|
| agentId | string (UUID) | Agent 模板 ID |
| threadId | string (UUID) | Thread ID |

### 响应

**200 OK**:

返回完整的 Thread 对象（同创建响应格式）。

### 错误响应

| 状态码 | error | 触发条件 |
|--------|-------|----------|
| 404 | `NOT_FOUND` | Thread 不存在，或不属于当前租户/Agent |
| 500 | `INTERNAL_ERROR` | 服务端异常 |

---

## PATCH /api/v1/agents/:agentId/threads/:threadId

更新 Thread 的标题或状态。需要 admin 角色。会验证 Thread 归属。

### 请求

**Path**:

| 参数 | 类型 | 说明 |
|------|------|------|
| agentId | string (UUID) | Agent 模板 ID |
| threadId | string (UUID) | Thread ID |

**Body**（所有字段可选）:

| 字段 | 类型 | 说明 |
|------|------|------|
| title | string | Thread 标题 |
| status | string | Thread 状态（`idle` / `running` / `completed` / `error`） |

```json
{
  "title": "处理 Q3 报表 - 已完成",
  "status": "completed"
}
```

### 响应

**200 OK**:

返回更新后的完整 Thread 对象。

### 错误响应

| 状态码 | error | 触发条件 |
|--------|-------|----------|
| 403 | `FORBIDDEN` | 非 admin 角色 |
| 404 | `NOT_FOUND` | Thread 不存在，或不属于当前租户/Agent |
| 500 | `INTERNAL_ERROR` | 服务端异常 |

---

## DELETE /api/v1/agents/:agentId/threads/:threadId

删除 Thread。同时释放关联的 Engine 资源。需要 admin 角色。会验证 Thread 归属。

### 请求

**Path**:

| 参数 | 类型 | 说明 |
|------|------|------|
| agentId | string (UUID) | Agent 模板 ID |
| threadId | string (UUID) | Thread ID |

### 响应

**204 No Content**:

无响应体。

### 错误响应

| 状态码 | error | 触发条件 |
|--------|-------|----------|
| 403 | `FORBIDDEN` | 非 admin 角色 |
| 404 | `NOT_FOUND` | Thread 不存在，或不属于当前租户/Agent |
| 500 | `INTERNAL_ERROR` | 服务端异常 |

---

## POST /api/v1/agents/:agentId/threads/:threadId/chat

向指定 Thread 发送消息，返回 SSE 流式响应。Thread 必须处于 `idle` 状态。

### 请求

**Path**:

| 参数 | 类型 | 说明 |
|------|------|------|
| agentId | string (UUID) | Agent 模板 ID |
| threadId | string (UUID) | Thread ID |

**Body**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| content | string | 是 | 用户消息内容 |

```json
{
  "content": "帮我分析一下这个月的销售数据"
}
```

### 响应

**200 OK** — `Content-Type: text/event-stream`

SSE 事件流，按时间顺序推送：

#### 事件 1: connected

连接建立确认。

```
event: connected
data: {"threadId":"uuid","timestamp":1714800000000}
```

#### 事件 2+: message（多次）

Agent 回复消息，逐条推送。

```
event: message
data: {"type":"assistant","content":"正在分析您的销售数据..."}
```

> 注意：当前 `event` 字段固定为 `message`，具体事件类型需要通过 `data.type` 字段区分。

#### 事件 N: done

对话完成，携带 token 用量统计。

```
event: done
data: {"usage":{"inputTokens":150,"outputTokens":500}}
```

#### 事件: error

发生错误时推送。

```
event: error
data: {"error":"QUERY_ERROR","message":"具体错误信息"}
```

### SSE 数据格式参考

```javascript
// 前端使用 fetch + ReadableStream 消费 SSE
const response = await fetch('/api/v1/agents/agent-id/threads/thread-id/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
  },
  body: JSON.stringify({ content: '用户消息' }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const text = decoder.decode(value);
  // 解析 SSE 格式: event: xxx\ndata: {...}\n\n
  const lines = text.split('\n');
  // ... 处理事件
}
```

### 错误响应

| 状态码 | error | 触发条件 |
|--------|-------|----------|
| 400 | `MISSING_CONTENT` | content 为空 |
| 400 | `BAD_REQUEST` | Thread 已结束（`completed` 或 `error` 状态） |
| 404 | `NOT_FOUND` | Thread 不存在，或不属于当前租户/Agent |
| 409 | `CONFLICT` | Thread 正在执行中（`running` 状态） |
| SSE error event | `QUERY_ERROR` | 对话执行过程中出错 |

> 注意：SSE 接口的 HTTP 层通常返回 200，运行时错误通过 SSE 事件推送。状态校验错误（400/404/409）在 HTTP 层直接返回。

---

## GET /api/v1/agents/:agentId/threads/:threadId/history

获取指定 Thread 的对话历史。消息来源于文件系统的 `transcript.jsonl`。

### 请求

**Path**:

| 参数 | 类型 | 说明 |
|------|------|------|
| agentId | string (UUID) | Agent 模板 ID |
| threadId | string (UUID) | Thread ID |

**Query**:

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| limit | integer | 50 | 返回最近的消息数量 |

```
GET /api/v1/agents/agent-id/threads/thread-id/history?limit=50
```

### 响应

**200 OK**:

```json
{
  "data": [
    {
      "role": "user",
      "content": "帮我分析一下这个月的销售数据",
      "timestamp": "2026-05-05T10:30:00.000Z"
    },
    {
      "role": "assistant",
      "content": "正在分析您的销售数据...",
      "timestamp": "2026-05-05T10:30:05.000Z"
    }
  ],
  "meta": {
    "threadId": "550e8400-e29b-41d4-a716-446655440000",
    "agentId": "880e8400-e29b-41d4-a716-446655440003",
    "limit": 50,
    "count": 2
  }
}
```

> 注意：
> - 消息来源于文件系统的 `transcript.jsonl`，格式由 SDK 定义
> - 如果 transcript 文件不存在，`data` 为空数组
> - 消息按时间正序排列，`limit` 生效时返回最近 N 条

### 无历史记录的响应

```json
{
  "data": [],
  "meta": {
    "threadId": "550e8400-e29b-41d4-a716-446655440000",
    "agentId": "880e8400-e29b-41d4-a716-446655440003",
    "limit": 50,
    "count": 0
  }
}
```

### 错误响应

| 状态码 | error | 触发条件 |
|--------|-------|----------|
| 404 | `NOT_FOUND` | Thread 不存在，或不属于当前租户/Agent |
| 500 | `INTERNAL_ERROR` | 服务端异常 |

---

## 与 Sessions 模块的关系

Thread 模块是 Sessions 模块的升级版。两者共享底层的 `sessions` 数据库表。

| 特性 | Sessions（旧） | Threads（新） |
|------|----------------|---------------|
| 对话管理 | 隐式（自动创建/复用） | 显式（手动创建、管理） |
| 多对话 | 不支持（单活跃 Session） | 支持（多个 Thread 并行） |
| 对话标题 | 无 | 支持 |
| 对话状态 | 无 | `idle` / `running` / `completed` / `error` |
| CRUD | 无 | 完整支持 |
| Engine 生命周期 | 每 Query 创建/销毁 | Thread 粒度复用（EnginePool） |

> 旧的 Sessions 接口（`/:agentId/chat`、`/:agentId/history`）仍可使用，内部已委托给 ThreadManager 实现，行为不变。建议新功能使用 Threads 接口。
