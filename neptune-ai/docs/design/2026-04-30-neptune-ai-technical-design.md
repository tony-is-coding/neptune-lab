# Neptune-AI 技术方案设计

> 日期: 2026-04-30
> 状态: 待审核
> 上游文档: [产品能力蓝图](./2026-04-30-neptune-ai-product-blueprint.md)
> 关联文档: [架构设计文档](./2026-04-29-neptune-ai-platform-architecture.md)

---

## 1. 核心架构模型

### 1.1 Engine 无状态化

**核心决策：AgentEngine 每 query 创建、用完销毁。不是进程常驻的。**

```
用户发消息
  → HTTP POST (userId, agentId, content)
  → 产品层创建 AgentEngine（指定 workspace）
  → Engine 从 workspace 恢复上下文（transcript、memory）
  → Engine 执行 query
  → 产物写入 workspace
  → 提取 token 用量 → 计费
  → Engine 销毁
  → SSE 流式响应返回用户
```

**推导依据：**
- Workspace 是状态的主人，Engine 是无状态的计算单元
- 与 Claude Code CLI 的本质模型一致 — 工作目录 = session 的全部状态
- 支持水平扩展：每个 query 可以由任意服务实例处理

### 1.2 三层存储模型

```
┌─────────────────────────────────────────────────────┐
│  文件系统 (Workspace) — Agent 状态主人               │
│  /data/tenants/{tenantId}/agents/{agentId}/         │
│    users/{userId}/                                   │
│      ├── workspace/          # 工作目录              │
│      ├── transcript.jsonl     # 对话历史             │
│      └── .claude/memory/      # Agent 记忆           │
├─────────────────────────────────────────────────────┤
│  PostgreSQL — 纯业务数据                              │
│  tenants / users / agent_templates / sessions       │
│  (注册表) / billing_records                          │
├─────────────────────────────────────────────────────┤
│  Redis — 配额计数 + SSE 缓冲                         │
│  quota counters / rate limits / event buffers       │
└─────────────────────────────────────────────────────┘
```

**各存储的职责边界：**

| 存储 | 存什么 | 不存什么 |
|------|--------|---------|
| 文件系统 | 对话内容、记忆、工作文件、Agent 状态 | 业务数据 |
| PG | 租户、用户、Agent 模板、Session 注册表、计费记录 | 对话内容、Agent 记忆 |
| Redis | Token 配额计数、SSE 断线缓冲 | 持久数据 |

---

## 2. 框架改 vs 产品改

### 2.1 框架侧改动（claude-code/）

**唯一改动：AgentEngine emit `query:complete` 事件**

当前 SDK 在 query 完成后不发出包含 token 用量的事件。产品层无法在 `engine.destroy()` 之前干净地获取 `SessionContext.modelUsage`。

改动位置：`claude-code/src/engine/AgentEngine.ts` 的 `query()` 方法 finally 块

```typescript
// query() 方法的 finally 块中新增
this.eventBus.emit('query:complete', {
  sessionId,
  usage: sessionCtx.modelUsage,
}, sessionId);
```

Payload 结构：
```typescript
{
  sessionId: string;
  usage: Record<string, {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
    costUSD: number;
  }>;
}
```

**不改的东西：**
- IMemoryStore 接口 — 记忆走文件系统
- 不新增 ScopedMemoryStore — memoryRoot + userId 隔离已够用
- 不改 Agent Loop 核心逻辑
- 不改 QueryEngine

### 2.2 产品侧改动（neptune-ai/server/）

| 改动 | 说明 | 复杂度 |
|------|------|--------|
| QueryDispatcher | 重写 session.ts，每 query 创建 Engine | 高 |
| SSE 流式端点 | POST /agents/:agentId/chat → SSE | 中 |
| 对话历史查询 | 读 transcript.jsonl | 低 |
| 认证中间件统一接入 | 所有路由加 preHandler | 低 |
| API 版本前缀 | /api/v1/ | 低 |
| Token 计费接线 | 订阅 query:complete → CostAggregator | 低 |
| DB schema 调整 | sessions 简化、messages 移除 | 低 |
| Tauri 桌面端 | 前端完整开发 | 高 |

---

## 3. Workspace 模型

### 3.1 目录结构

```
/data/tenants/{tenantId}/agents/{agentId}/users/{userId}/
  ├── workspace/                 # Agent 工作目录（产出文件）
  ├── transcript.jsonl           # 对话历史（SDK 自动管理）
  └── .claude/
      └── memory/                # Agent 记忆（SDK 通过 memoryRoot 管理）
```

### 3.2 记忆隔离

SDK 的 `setMemoryPath(sessionId, userId)` 创建 `{memoryRoot}/{userId}/memory/`。

产品设置：
```
memoryRoot = /data/tenants/{tenantId}/agents/{agentId}/
```

SDK 自动产出：
```
/data/tenants/{tenantId}/agents/{agentId}/{userId}/memory/
```

自然实现按 Agent 隔离记忆，无需修改框架。

### 3.3 Session 恢复流程

```typescript
// 每个 query 的恢复逻辑
const engine = AgentEngine.create(config);

let sessionId = await engine.loadSession({ workspace });
if (!sessionId) {
  // 首次使用此 Agent，创建新 session
  sessionId = await engine.createSession({ workspace, systemPrompt });
}

// 设置记忆路径
engine.setMemoryPath(sessionId, userId);

// 执行 query
for await (const event of engine.query(sessionId, content)) {
  // SSE 流式转发
}

// 提取 token 用量 → 计费
// 从 query:complete 事件获取

// 销毁 engine
await engine.destroy();
```

---

## 4. 数据库设计

### 4.1 保留的表

**tenants** — 不变

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| name | TEXT | 租户名 |
| slug | TEXT UNIQUE | URL 标识 |
| status | TEXT | active/suspended |
| quota | JSONB | 配额配置 |
| billing_config | JSONB | 计费配置 |
| created_at / updated_at | TIMESTAMP | |

**users** — 不变

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| tenant_id | UUID FK→tenants | |
| email | TEXT UNIQUE | |
| password_hash | TEXT | bcrypt |
| name | TEXT | |
| role | TEXT | 'admin' / 'user' |
| created_at / updated_at | TIMESTAMP | |

**agent_templates** — 不变

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| tenant_id | UUID FK→tenants | |
| name | TEXT | Agent 名称 |
| description | TEXT | |
| system_prompt | TEXT | 系统提示词 |
| model_config | JSONB | provider/model/temperature/maxTokens |
| tools | JSONB | 工具白名单 |
| skills | JSONB | Skill 引用列表 |
| mcp_servers | JSONB | MCP Server 配置 |
| constraints | JSONB | 限制配置 |
| version | INTEGER | 模板版本 |
| is_active | BOOLEAN | |
| created_at / updated_at | TIMESTAMP | |

**billing_records** — 不变

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGSERIAL PK | |
| tenant_id | UUID | |
| session_id | TEXT | |
| user_id | UUID | |
| input_tokens | INTEGER | |
| output_tokens | INTEGER | |
| model | TEXT | |
| cost_cents | INTEGER | 费用（分） |
| created_at | TIMESTAMP | |

### 4.2 简化的 sessions 表

从"状态存储"降级为"轻量注册表"：

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID NOT NULL REFERENCES users(id),
  template_id UUID NOT NULL REFERENCES agent_templates(id),
  workspace_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  last_active_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  -- 每个 (user, agent) 只有一个活跃 session
  UNIQUE (user_id, template_id) WHERE status = 'active'
);

CREATE INDEX sessions_tenant_status ON sessions(tenant_id, status);
CREATE INDEX sessions_user_id ON sessions(user_id);
```

**设计原则：**
- source of truth = 文件系统（transcript.jsonl）
- sessions 表 = 查询加速索引（可从文件系统重建）
- 唯一约束保证 1 Agent = 1 活跃 Session

### 4.3 移除的表

**messages** — 移除。对话内容由 transcript.jsonl 承载。

移除理由：
1. transcript.jsonl 已是完整对话记录，由 SDK 管理
2. 双写（workspace + PG）增加复杂度和故障点
3. 对话历史展示通过读 transcript.jsonl 实现
4. 未来如需全文搜索，可异步索引

---

## 5. API 设计

### 5.1 路由总览

| 方法 | 路径 | 说明 | 认证 | 角色 |
|------|------|------|------|------|
| POST | /api/v1/auth/login | 登录 | 无 | — |
| POST | /api/v1/auth/register | 注册 | 无 | — |
| POST | /api/v1/auth/token/refresh | 刷新 token | refresh | — |
| GET | /api/v1/agents | Agent 列表 | JWT | any |
| GET | /api/v1/agents/:id | Agent 详情 | JWT | any |
| POST | /api/v1/agents | 创建 Agent 模板 | JWT | admin |
| PUT | /api/v1/agents/:id | 更新模板 | JWT | admin |
| DELETE | /api/v1/agents/:id | 删除模板 | JWT | admin |
| PATCH | /api/v1/agents/:id/activate | 激活 | JWT | admin |
| PATCH | /api/v1/agents/:id/deactivate | 停用 | JWT | admin |
| **POST** | **/api/v1/agents/:agentId/chat** | **发送消息（SSE 响应）** | **JWT** | **any** |
| **GET** | **/api/v1/agents/:agentId/history** | **对话历史** | **JWT** | **any** |
| GET | /api/v1/tenants/:id/billing | 计费查询 | JWT | admin |
| GET | /api/v1/users | 用户列表 | JWT | admin |
| POST | /api/v1/users | 创建用户 | JWT | admin |
| GET | /api/v1/users/:id | 用户详情 | JWT | admin |
| PUT | /api/v1/users/:id | 更新用户 | JWT | admin |
| DELETE | /api/v1/users/:id | 删除用户 | JWT | admin |

### 5.2 核心端点：POST /agents/:agentId/chat

**请求：**
```http
POST /api/v1/agents/{agentId}/chat
Authorization: Bearer {jwt}
Content-Type: application/json

{
  "content": "帮我分析下这个季度的预算执行情况",
  "metadata": {}
}
```

**响应：** SSE 流
```
event: message
data: {"type":"text","content":"正在查询"}

event: message
data: {"type":"tool_use","name":"read_file","input":{"path":"budget.xlsx"}}

event: message
data: {"type":"text","content":"根据数据分析..."}

event: done
data: {"usage":{"inputTokens":1500,"outputTokens":800}}
```

**处理流程：**

```
1. JWT 认证 → userId, tenantId
2. 查 agent_templates → systemPrompt, tools, mcpServers, constraints
3. 权限检查 → TenantPermissionDelegate
4. 查 sessions 表 → 是否已有 (userId, agentId) 的 workspace
   → 有：workspace_path 已知
   → 无：创建目录 + 插入 sessions 记录
5. AgentEngine.create({
     systemPrompt: template.systemPrompt,
     sessionStore: new FilesystemBackend(...),
     extensions: {
       permissions: { permissionDelegate: tenantPermDelegate }
     },
     provider: template.modelConfig,
   })
6. engine.loadSession({ workspace }) || engine.createSession({ workspace })
7. engine.setMemoryPath(sessionId, userId)
8. 设置 SSE 响应头
9. for await (event of engine.query(sessionId, content)):
     → SSE 推送 event
10. 从 query:complete 事件提取 usage
11. costAggregator.recordUsage(tenantId, sessionId, userId, usage)
12. 更新 sessions.last_active_at
13. engine.destroy()
```

### 5.3 对话历史端点：GET /agents/:agentId/history

```http
GET /api/v1/agents/{agentId}/history?limit=50&before={seqNum}
Authorization: Bearer {jwt}
```

**实现：** 读取 workspace 下的 transcript.jsonl，解析为消息列表，基于 seqNum 实现游标分页。

---

## 6. 实施阶段

### Phase 2A: 后端架构对齐

**前置条件：** 框架侧 `query:complete` 事件已添加

| 编号 | 任务 | 说明 | 依赖 |
|------|------|------|------|
| 2A-1 | 框架：添加 query:complete 事件 | AgentEngine.ts finally 块 | 无 |
| 2A-2 | 产品：重写 QueryDispatcher | 新的 session.ts，每 query 创建 Engine | 2A-1 |
| 2A-3 | 产品：SSE 流式端点 | POST /agents/:agentId/chat | 2A-2 |
| 2A-4 | 产品：对话历史端点 | GET /agents/:agentId/history | 2A-2 |
| 2A-5 | 产品：认证中间件统一接入 | 所有路由加 preHandler | 无 |
| 2A-6 | 产品：API 版本前缀 | /api/v1/ | 无 |
| 2A-7 | 产品：Token 计费接线 | query:complete → CostAggregator | 2A-1, 2A-2 |
| 2A-8 | 产品：DB schema 调整 | sessions 简化、messages 移除 | 无 |

**可并行：**
- 2A-1（框架）与 2A-5/2A-6/2A-8（产品基础设施）并行
- 2A-2/2A-3/2A-4（核心流程）在 2A-1 完成后串行
- 2A-7（计费）在 2A-1 + 2A-2 完成后接入

### Phase 2B: Tauri 桌面端

| 编号 | 任务 | 说明 |
|------|------|------|
| 2B-1 | Tauri + React 项目搭建 | 项目初始化、路由、状态管理 |
| 2B-2 | Agent 列表页 | 首页，展示用户可用的 Agent |
| 2B-3 | Agent 对话页 | SSE 流式对话界面 |
| 2B-4 | Admin: Agent 模板管理 | 创建/编辑 Agent |
| 2B-5 | Admin: 用户管理 | 用户 CRUD |
| 2B-6 | Admin: 计费查看 | 用量统计 |

### Phase 2C: 集成验证

| 编号 | 任务 | 说明 |
|------|------|------|
| 2C-1 | 端到端测试 | 创建 Agent → 对话 → 查看历史 → 计费 |
| 2C-2 | 多租户隔离验证 | 不同租户的 workspace 隔离 |
| 2C-3 | 记忆持久化验证 | Agent 是否"记住"用户信息 |

---

## 7. Phase 1 产物处理

| Phase 1 产物 | 处理 | 理由 |
|-------------|------|------|
| `services/session.ts` | **重写** | 常驻 Engine → 每 query 临时 Engine |
| `services/permission-delegate.ts` | **保留** | 仍在 Engine 创建时注入 |
| `services/cost.ts` | **保留，微调** | 新增从 query:complete 事件提取 usage 的适配 |
| `services/auth.ts` | **保留** | 不变 |
| `services/agent-template.ts` | **保留** | 不变 |
| `services/tenant.ts` / `user.ts` | **保留** | 不变 |
| `routes/sessions.ts` | **重写** | 改为 /agents/:agentId/chat + /history |
| `routes/agents.ts` | **微调** | 加认证中间件 |
| `routes/billing.ts` | **保留** | 不变 |
| `routes/tenants.ts` / `users.ts` | **微调** | 加认证中间件 |
| `db/schema.ts` messages 表 | **移除** | transcript.jsonl 替代 |
| `db/schema.ts` sessions 表 | **简化** | 降级为注册表 |
| PgSessionStore / PgContentStore | **暂不使用** | Engine 用文件 transcript |

---

## 8. 技术风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| 文件系统 I/O 成为瓶颈 | 中 | transcript.jsonl 是追加写，性能足够。如需优化可异步刷盘 |
| Engine 创建开销 | 低 | AgentEngine.create() 是纯内存构造，实测 < 10ms |
| 并发 query 同一 Agent | 中 | SDK 有 session 级互斥锁，产品层可排队或提示"Agent 正在处理中" |
| workspace 磁盘空间 | 低 | 定期清理已归档 session 的 workspace |
| query:complete 事件遗漏 | 中 | 在 engine.destroy() 前检查是否有 usage 数据，缺失则记录告警 |
