# Neptune-AI API 文档

> Base URL: `http://localhost:3000`
> API 前缀: `/api/v1`
> 版本: v1
> 最后更新: 2026-05-04

## 目录

- [认证规范](#认证规范)
- [请求规范](#请求规范)
- [响应规范](#响应规范)
- [错误处理](#错误处理)
- [分页规范](#分页规范)
- [SSE 协议规范](#sse-协议规范)
- [模块文档](#模块文档)

---

## 认证规范

### 认证方式

所有需要认证的接口使用 Bearer Token 方式：

```
Authorization: Bearer <accessToken>
```

### 令牌体系

| 令牌类型 | 有效期 | 用途 |
|----------|--------|------|
| accessToken | 1 小时 | 接口调用凭证 |
| refreshToken | 7 天 | 刷新 accessToken |

### 令牌生命周期

1. 用户登录/注册成功后，返回 `accessToken` + `refreshToken`
2. 每次 API 请求携带 `accessToken`
3. `accessToken` 过期前，用 `refreshToken` 调用 `POST /api/v1/auth/token/refresh` 换取新令牌对
4. 收到 `401` 响应时，前端应清除本地存储并跳转登录页

### 令牌载荷 (JWT Payload)

```json
{
  "userId": "uuid",
  "tenantId": "uuid",
  "email": "user@example.com",
  "role": "admin | user",
  "iat": 1714800000,
  "exp": 1714803600
}
```

### 角色体系

| 角色 | 说明 |
|------|------|
| `platform_admin` | 平台管理员，可查看所有租户的账单等跨租户操作 |
| `admin` / `tenant_admin` | 租户管理员，可执行租户内的创建/更新/删除操作 |
| `user` | 普通用户，仅可查看和使用 |

> 注意：注册时创建租户的用户角色为 `admin`，billing 接口中使用 `tenant_admin` 做权限判断。

---

## 请求规范

### Content-Type

| 场景 | Content-Type |
|------|-------------|
| 普通接口 | `application/json` |
| SSE 对话 | 自动设置 `text/event-stream`（无需手动设置） |

### 请求头

```
Content-Type: application/json
Authorization: Bearer <accessToken>  // 需要认证的接口
```

---

## 响应规范

### 成功响应

**单资源** — HTTP 200/201：

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "xxx",
  "createdAt": "2026-05-04T10:30:00.000Z"
}
```

**列表** — HTTP 200：

```json
{
  "data": [
    { "id": "...", "name": "..." }
  ],
  "meta": {
    "count": 10,
    "limit": 100,
    "offset": 0
  }
}
```

**删除成功** — HTTP 204：

无响应体。

### 创建成功

HTTP 201，返回创建的资源对象。

---

## 错误处理

### 错误响应格式

```json
{
  "error": "ERROR_CODE",
  "message": "人类可读的错误描述"
}
```

部分错误响应会包含额外的 `details` 字段。

### 错误码

| HTTP 状态码 | error 值 | 含义 | 触发场景 |
|-------------|----------|------|----------|
| 400 | `BAD_REQUEST` | 请求参数错误 | 缺少必填字段、参数格式错误 |
| 401 | `UNAUTHORIZED` | 未认证或令牌无效 | 未携带 Token、Token 过期、Token 无效 |
| 403 | `FORBIDDEN` | 权限不足 | 非 admin 角色尝试执行管理操作 |
| 404 | `NOT_FOUND` | 资源不存在 | 查询的 ID 不存在 |
| 500 | `INTERNAL_ERROR` | 服务端内部错误 | 未预期的服务端异常 |

---

## 分页规范

列表接口统一支持分页，参数通过 Query String 传递：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `limit` | integer | 100 | 每页数量 |
| `offset` | integer | 0 | 偏移量 |

示例：

```
GET /api/v1/agents?limit=20&offset=0
```

---

## SSE 协议规范

Agent 对话使用 Server-Sent Events (SSE) 协议实现流式响应。

### 响应头

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no
```

### 事件类型

| event | 数据格式 | 说明 |
|-------|----------|------|
| `connected` | `{ agentId, timestamp }` | 连接建立确认，首次事件 |
| `message` | `{ type, ... }` | Agent 回复消息，流式逐条推送。SSE event name 固定为 `message`，事件的具体类型通过 `data.type` 区分 |
| `done` | `{ usage: { ... } }` | 对话完成，携带 token 用量统计 |
| `error` | `{ error, message }` | 发生错误 |

### SSE 数据格式

```
event: connected
data: {"agentId":"xxx","timestamp":1714800000000}

event: message
data: {"type":"assistant","content":"..."}

event: done
data: {"usage":{"inputTokens":100,"outputTokens":500}}

event: error
data: {"error":"QUERY_ERROR","message":"..."}
```

### 客户端断开

客户端关闭连接后，服务端会自动检测并停止生成。

---

## 模块文档

| 模块 | 文件 | 说明 |
|------|------|------|
| 认证 | [auth.md](./auth.md) | 登录、注册、令牌刷新、获取当前用户 |
| 租户 | [tenants.md](./tenants.md) | 租户 CRUD |
| 用户 | [users.md](./users.md) | 用户 CRUD |
| Agent 模板 | [agents.md](./agents.md) | Agent CRUD、激活/停用、统计、文档管理 |
| 对话 | [sessions.md](./sessions.md) | SSE 流式对话、历史记录 |
| 计费 | [billing.md](./billing.md) | 租户账单汇总 |
| 缺口分析 | [gap-analysis.md](./gap-analysis.md) | 前端需求 vs 现有接口差异 |

---

## 健康检查端点

以下端点不在 `/api/v1` 前缀下，无需认证：

### GET /health

应用健康状态。

**响应**:

```json
{
  "status": "ok",
  "timestamp": "2026-05-04T10:30:00.000Z",
  "uptime": 3600.5
}
```

### GET /health/db

数据库连接状态。

**响应**（正常）:

```json
{
  "status": "ok",
  "database": "connected"
}
```

**响应**（异常）:

```json
{
  "status": "error",
  "database": "disconnected",
  "error": "Connection refused"
}
```
