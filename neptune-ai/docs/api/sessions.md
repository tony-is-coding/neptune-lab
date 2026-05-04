# 对话模块 (Sessions)

> **已废弃**：Sessions 模块已被 [Thread 模块](./threads.md) 替代。Thread 提供显式的对话线程管理、多对话支持、状态追踪等能力。旧的 Sessions 接口（`/:agentId/chat`、`/:agentId/history`）仍可使用，内部已委托给 ThreadManager 实现以保持向后兼容。建议新功能使用 Thread 接口。

## 接口总览

| 方法 | 路径 | 认证 | 角色 | 说明 |
|------|------|------|------|------|
| POST | `/api/v1/agents/:agentId/chat` | Bearer | 任意已认证 | SSE 流式对话 |
| GET | `/api/v1/agents/:agentId/history` | Bearer | 任意已认证 | 获取对话历史 |

> 对话路由注册在 `/api/v1/agents` 前缀下，与 Agent 模板路由共享前缀。

---

## POST /api/v1/agents/:agentId/chat

与 Agent 进行对话，返回 SSE 流式响应。

### 请求

**Path**:

| 参数 | 类型 | 说明 |
|------|------|------|
| agentId | string (UUID) | Agent 模板 ID |

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
data: {"agentId":"uuid","timestamp":1714800000000}
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
const response = await fetch('/api/v1/agents/agent-id/chat', {
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
| SSE error event | `QUERY_ERROR` | 对话执行过程中出错 |

> 注意：SSE 接口的 HTTP 层通常返回 200，错误通过 SSE 事件推送。

---

## GET /api/v1/agents/:agentId/history

获取 Agent 的对话历史。自动查找当前用户最新的活跃 Session。

### 请求

**Path**:

| 参数 | 类型 | 说明 |
|------|------|------|
| agentId | string (UUID) | Agent 模板 ID |

**Query**:

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| limit | integer | 50 | 返回最近的消息数量 |

```
GET /api/v1/agents/agent-id/history?limit=50
```

### 响应

**200 OK**:

```json
{
  "data": [
    {
      "role": "user",
      "content": "帮我分析一下这个月的销售数据",
      "timestamp": "2026-05-04T10:30:00.000Z"
    },
    {
      "role": "assistant",
      "content": "正在分析您的销售数据...",
      "timestamp": "2026-05-04T10:30:05.000Z"
    }
  ],
  "meta": {
    "agentId": "uuid",
    "sessionId": "session-id-string",
    "limit": 50,
    "count": 2
  }
}
```

> 注意：
> - 消息来源于文件系统的 `transcript.jsonl`，格式由 SDK 定义
> - 如果没有活跃的 Session，`data` 为空数组，`meta.message` 为 `"No active session found"`
> - 消息按时间正序排列，`limit` 生效时返回最近 N 条

### 无活跃 Session 的响应

```json
{
  "data": [],
  "meta": {
    "agentId": "uuid",
    "limit": 50,
    "message": "No active session found"
  }
}
```

### 错误响应

| 状态码 | error | 触发条件 |
|--------|-------|----------|
| 500 | `INTERNAL_ERROR` | 服务端异常 |
