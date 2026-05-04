# Neptune AI 后端架构参考

> 供测试 SKILL 理解系统结构，确保用例覆盖所有关键端点。

## 技术栈

| 层级 | 技术 | 用途 |
|------|------|------|
| 运行时 | Bun | JS/TS 运行时 + 包管理 |
| 框架 | Fastify 5.2 | HTTP 服务 |
| 数据库 | PostgreSQL 16 | 关系型存储 |
| ORM | Drizzle ORM 0.36 | 类型安全 SQL |
| 缓存 | Redis 7 | 配额计数器 |
| 认证 | jose (HS256) | JWT 签发/验证 |
| 密码 | bcrypt | 哈希存储 |

## 启动方式

```bash
# 1. 基础设施
cd neptune-ai/server && docker-compose up -d   # PG :5433, Redis :6380

# 2. 安装依赖
bun install

# 3. 启动后端
bun run dev   # 监听 http://0.0.0.0:3000
```

## 数据库连接

- PG: `postgresql://postgres:postgres@localhost:5433/neptune_ai`
- Redis: `redis://localhost:6380`

## API 路由全列表

前缀: `/api/v1`

### 健康检查（无需认证）

| 方法 | 路径 | 响应 |
|------|------|------|
| GET | `/health` | `{ status: "ok", timestamp, uptime }` |
| GET | `/health/db` | `{ status: "ok", database: "connected" }` |

### 认证 `/api/v1/auth`

| 方法 | 路径 | 认证 | 功能 |
|------|------|------|------|
| POST | `/api/v1/auth/register` | 无 | 注册。两种模式：(1) `{email,password,name,tenantId}` → user 角色 (2) `{email,password,name,tenantName}` → admin 角色 |
| POST | `/api/v1/auth/login` | 无 | 登录，返回 `{user:{id,name,email,role,tenantId}, accessToken, refreshToken, expiresIn}` |
| POST | `/api/v1/auth/token/refresh` | 无 | `{refreshToken}` → `{accessToken, refreshToken, expiresIn}` |
| GET | `/api/v1/auth/me` | Bearer | 返回 `{id, name, email, role, tenantId}` |

### 租户 `/api/v1/tenants`

| 方法 | 路径 | 角色 | 功能 |
|------|------|------|------|
| POST | `/api/v1/tenants` | admin | 创建租户 |
| GET | `/api/v1/tenants` | admin | 列表（limit/offset） |
| GET | `/api/v1/tenants/:id` | admin | 详情 |
| PUT | `/api/v1/tenants/:id` | admin | 更新 |
| DELETE | `/api/v1/tenants/:id` | admin | 删除 |

### 用户 `/api/v1/users`

| 方法 | 路径 | 角色 | 功能 |
|------|------|------|------|
| POST | `/api/v1/users` | admin | 创建用户（同租户） |
| GET | `/api/v1/users` | user+ | 当前租户用户列表 |
| GET | `/api/v1/users/:id` | user+ | 用户详情 |
| PUT | `/api/v1/users/:id` | admin | 更新（含密码重置） |
| DELETE | `/api/v1/users/:id` | admin | 删除 |

### Agent 模板 `/api/v1/agents`

| 方法 | 路径 | 角色 | 功能 |
|------|------|------|------|
| POST | `/api/v1/agents` | admin | 创建模板 |
| GET | `/api/v1/agents` | user+ | 列表（支持 `?active=true` 过滤） |
| GET | `/api/v1/agents/:id` | user+ | 详情 |
| PUT | `/api/v1/agents/:id` | admin | 更新 |
| PATCH | `/api/v1/agents/:id/activate` | admin | 激活 |
| PATCH | `/api/v1/agents/:id/deactivate` | admin | 停用 |
| DELETE | `/api/v1/agents/:id` | admin | 删除 |

### Agent Chat `/api/v1/agents/:agentId`

| 方法 | 路径 | 认证 | 功能 |
|------|------|------|------|
| POST | `/api/v1/agents/:agentId/chat` | Bearer | SSE 对话。请求体: `{content: string}`。响应: `text/event-stream` |
| GET | `/api/v1/agents/:agentId/history` | Bearer | 对话历史 `{data: [...], meta: {agentId, sessionId, count}}` |

### 计费 `/api/v1/tenants/:id/billing`

| 方法 | 路径 | 角色 | 功能 |
|------|------|------|------|
| GET | `/api/v1/tenants/:id/billing` | tenant_admin 或 platform_admin | `{tenantId, database, realtime}` |

## 响应格式

### 注册/登录成功响应

```json
{
  "user": { "id": "uuid", "name": "...", "email": "...", "role": "admin|user", "tenantId": "uuid" },
  "accessToken": "jwt...",
  "refreshToken": "jwt...",
  "expiresIn": 3600
}
```

### 错误响应

```json
{ "error": "ERROR_CODE", "message": "描述" }
```

错误码: `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `INTERNAL_ERROR`

### SSE 事件流

```
event: connected
data: {"agentId":"...","timestamp":...}

event: message
data: {"type":"...","content":"..."}

event: done
data: {"usage":{...}}

event: error
data: {"error":"QUERY_ERROR","message":"..."}
```

## RBAC 角色

| 角色 | 来源 | 权限 |
|------|------|------|
| `admin` | 注册时创建新租户 | 全量 CRUD + 用户管理 + Agent 管理 |
| `user` | 注册时加入已有租户 | 只读 + Chat |
| `tenant_admin` | (需后端手动设置) | admin 权限 + billing 访问 |
| `platform_admin` | (需后端手动设置) | 平台级管理 + billing 访问 |

**注意**: 当前注册创建的 `admin` 角色无法访问 billing 端点（billing 要求 `tenant_admin` 或 `platform_admin`）。

## 数据模型

5 张核心表（按外键依赖顺序）：

1. `tenants` — id(UUID), name, quota(JSONB), billingConfig(JSONB)
2. `users` — id(UUID), tenantId→tenants, name, email(UNIQUE), passwordHash, role
3. `agent_templates` — id(UUID), tenantId→tenants, name, description, systemPrompt, modelConfig(JSONB), tools(JSONB), skills(JSONB), mcpServers(JSONB), constraints(JSONB), version, isActive
4. `sessions` — id(TEXT), tenantId→tenants, userId→users, templateId→agent_templates, status, workspace
5. `billing_records` — id(BIGSERIAL), tenantId→tenants, sessionId, userId→users, inputTokens, outputTokens, model, costCents
