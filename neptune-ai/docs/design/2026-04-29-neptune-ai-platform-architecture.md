# Neptune-AI 企业级 Agent 应用平台架构设计

> 版本: v1.1 (审查修正版)
> 日期: 2026-04-29
> 状态: 设计评审中
> 作者: 基于 brainstorming 讨论输出
> 审查修正: 对齐 SDK 实际接口、补充安全模型、确定技术选型

---

## 1. 产品定位

### 1.1 一句话描述

**Neptune-AI 是面向企业业务人员的 Agent 配置与运行平台**——非技术用户可以在上面搭建 Skill、配置智能体，沉淀为可复用的配置，然后通过桌面端 APP 与 Agent 交互完成任务。

### 1.2 类比理解

企业级的 Claude Code，但面向非技术人员。用户不写代码，通过配置（system prompt、工具选择、MCP 接入、Skill 挂载）来定义 Agent 的行为。

### 1.3 用户画像

| 用户 | 角色 | 核心需求 |
|------|------|---------|
| 平台管理员 | Neptune-AI 运营方 | 管理租户、配额、系统监控 |
| 租户管理员 | 企业 IT 管理员 | 管理 Agent 模板、用户权限、MCP 接入、费用管控 |
| 业务用户 | 运营/客服/市场等 | 配置/使用 Agent 完成日常工作任务 |

### 1.4 核心使用场景

- 信息处理：文档分析、报告生成、数据查询、内容创作
- 操作执行：调用企业 API、触发工作流、发送通知
- 企业数据接入：通过 MCP 协议对接企业内部系统

---

## 2. 系统架构

### 2.1 架构全景图

```
┌─────────────────────────────────────────────────────────────┐
│                   Desktop APP (Tauri)                        │
│  React + TypeScript | SSE Client + HTTP POST                │
│  macOS 原生体验 | ~10MB 安装包                               │
└───────────────────────────┬─────────────────────────────────┘
                            │
              SSE (流式输出) │ HTTP POST (用户操作)
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                编排层 (Orchestration Layer)                   │
│                Neptune-AI Platform Service                   │
│                Bun + Fastify + PostgreSQL + Redis             │
│                                                              │
│  ┌──────────── 核心模块 ─────────────┐  ┌────── 基础设施 ──┐ │
│  │ [Auth]      JWT + OAuth2 SSO      │  │ [SSE Bridge]    │ │
│  │ [Tenant]    CRUD + 配额规则       │  │ EventBus → SSE  │ │
│  │ [User]      用户 + 角色管理       │  │ + Redis 缓冲    │ │
│  │ [Config]    AgentTemplate CRUD    │  │ [EventBuffer]   │ │
│  │ [Skill]     注册表 + 分发         │  │ [CostAggregator]│ │
│  │ [MCP]       注册表 + 连接管理     │  │ [HealthMonitor] │ │
│  │ [Session]   路由 + 生命周期       │  │                 │ │
│  └───────────────────────────────────┘  └─────────────────┘ │
│                                                              │
│  PostgreSQL          Redis                                   │
│  - 租户/用户配置     - SSE 事件缓冲                           │
│  - Agent 模板        - 配额计数器                             │
│  - Session 元数据    - 在线状态                               │
│  - 对话内容          - 分布式锁                               │
│  - 计费记录                                                   │
├──────────────────── SDK 集成边界 ────────────────────────────┤
│                                                              │
│              执行引擎层 (Execution Engine Layer)               │
│              Agent Engine SDK (现有 claude-code)              │
│                                                              │
│  ┌─────────────── Engine Instance ─────────────────┐        │
│  │  AgentEngine.create(config)                      │        │
│  │                                                  │        │
│  │  Session #1     Session #2     Session #3  ...   │        │
│  │  [租户A/用户1]  [租户B/用户3]  [租户A/用户2]      │        │
│  │                                                  │        │
│  │  每个 Session 注入:                               │        │
│  │  - TenantPermissionDelegate (工具/MCP 白名单)    │        │
│  │  - per-session Provider (模型/API Key)           │        │
│  │  - per-session MCP config                       │        │
│  │  - TokenBudgetManager (配额限制)                 │        │
│  └──────────────────────────────────────────────────┘        │
│                                                              │
│  SDK 改造范围:                                               │
│  - ISessionStore → PostgreSQL 实现                           │
│  - ISessionContentStore → PostgreSQL 实现                    │
│  - IMemoryStore → Redis 实现                                 │
│  - EventBus 外部订阅接口                                     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 分层职责

| 层 | 职责边界 | 知道什么 | 不知道什么 |
|----|---------|---------|-----------|
| **Desktop APP** | UI 渲染、用户交互、SSE 消费 | API 接口、SSE 事件格式 | SDK 内部、Agent 执行细节 |
| **编排层** | 租户/用户/Session 生命周期、配额计费、路由分发 | 所有 session 的归属和状态 | Agent Loop 内部逻辑 |
| **执行引擎层** | Agent Loop 执行、工具调用、上下文管理 | 当前 session 的执行上下文 | 其他 session、租户概念、客户端 |

---

## 3. 通信协议

### 3.1 协议选择：SSE + HTTP POST

**为什么不用 WebSocket：**
- Agent 系统的通信模式是服务端推流为主（Agent 输出高频），客户端发送为辅（用户消息低频）
- SSE 原生支持服务端推流，HTTP POST 足以处理客户端发送
- SSE 通过标准 HTTP 基础设施（nginx/CDN/负载均衡），无需特殊配置
- SSE 有原生 Last-Event-ID 断线重连机制
- 服务器资源占用更低（就是 HTTP 响应流，不是独立的状态机）

### 3.2 API 设计

**客户端 → 服务端 (HTTP POST/DELETE)**

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 用户登录 |
| POST | `/api/auth/token/refresh` | Token 刷新 |
| GET | `/api/tenants/:id/agents` | 获取租户的 Agent 模板列表 |
| POST | `/api/sessions` | 创建 Session（指定 Agent 模板） |
| POST | `/api/sessions/:id/messages` | 发送用户消息 |
| POST | `/api/sessions/:id/cancel` | 取消当前执行 |
| DELETE | `/api/sessions/:id` | 销毁 Session |

**服务端 → 客户端 (SSE)**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/sessions/:id/events` | SSE 事件流 |

### 3.3 SSE 事件协议

```
事件类型映射自 SDK EventBus（注：最终事件名称以 Phase 0 集成测试时
产出的 SDK 实际事件清单为准，以下为设计意图）：

event: session_created
data: { "sessionId": "...", "status": "running" }

event: agent_thinking
data: { "sessionId": "...", "content": "..." }

event: agent_text
data: { "sessionId": "...", "content": "..." }

event: tool_call
data: { "sessionId": "...", "tool": "FileRead", "input": {...} }

event: tool_result
data: { "sessionId": "...", "tool": "FileRead", "output": "..." }

event: query_complete
data: { "sessionId": "...", "usage": { "inputTokens": 1234, "outputTokens": 567 } }

event: error
data: { "sessionId": "...", "code": "...", "message": "..." }
```

> **Phase 0 产出物**：在实现 EventBus 外部订阅接口时，同时产出一份
> `SDK 实际事件类型清单.md`，包含所有 `AgentEngine.emit()` 的事件名、
> payload 结构、触发时机。SSE Bridge 的映射将基于此清单实现。

### 3.4 断线重连机制

```
1. 客户端 SSE 连接断开
2. 服务端：Agent 继续执行（不依赖客户端连接），事件写入 Redis 缓冲区
3. 客户端重新连接：GET /api/sessions/:id/events
   Header: Last-Event-ID: evt_12345
4. 服务端：从 Redis 缓冲区读取 evt_12345 之后的事件，先补发
5. 然后继续推送实时事件
6. Redis 缓冲区保留最近 N 条事件（可配置 TTL）
```

---

## 4. 安全模型

### 4.1 MVP 阶段（3-5 租户）：SDK 级工具权限控制

通过组合 SDK 现有的 `RBACPermissionDelegate` + 自定义路径检查逻辑，为每个 Session 注入。

**SDK 实际接口**（`PermissionDelegate`）：
```typescript
// SDK 中的实际接口签名
interface PermissionDelegate {
  onToolAccess(toolName: string, input: Record<string, unknown>): Promise<'allow' | 'deny' | 'ask'>
}
```

**Neptune-AI 的实现策略**：

```typescript
class TenantPermissionDelegate implements PermissionDelegate {
  private rbac: RBACPermissionDelegate  // 组合 SDK 现有的 RBAC

  constructor(
    private tenantConfig: TenantConfig,
    private agentTemplate: AgentTemplate,
  ) {
    // 用 Agent 模板的工具白名单初始化 RBAC
    this.rbac = new RBACPermissionDelegate('agent', {
      allow: agentTemplate.tools.map(t => `${t}*`),  // 工具名通配符
      deny: ['Bash*', 'EnterPlanMode*', 'ExitPlanMode*'],  // 明确禁用
    })
  }

  async onToolAccess(toolName: string, input: Record<string, unknown>): Promise<'allow' | 'deny'> {
    // 1. RBAC 白名单检查（利用 SDK 现有能力）
    const rbacResult = await this.rbac.onToolAccess(toolName, input)
    if (rbacResult === 'deny') return 'deny'

    // 2. 文件操作：路径限制在租户 workspace 内
    if (isFileTool(toolName)) {
      const path = input.file_path || input.path
      if (path && !isWithinWorkspace(path, this.tenantConfig.workspace)) {
        return 'deny'
      }
    }

    // 3. MCP 调用：仅允许租户注册的 MCP Server
    if (toolName === 'mcp__') {
      const serverName = input.serverName as string
      if (!this.tenantConfig.mcpServers.includes(serverName)) {
        return 'deny'
      }
    }

    return 'allow'
    // 注意：永远不返回 'ask'——服务端无头模式，没有用户可交互确认
  }
}
```

**设计原则**：
- 组合而非重写 SDK 的 `RBACPermissionDelegate`，利用其已有的通配符匹配和角色映射能力
- **永远不返回 `'ask'`**——Neptune-AI 运行在服务端无头模式，没有终端用户可做交互式确认。所有场景必须明确 allow 或 deny
- 内部工具（TaskCreate/TaskList/TaskUpdate 等）通过 RBAC allow 列表放行，无需额外逻辑

### 4.2 工具策略

| 工具类别 | MVP 策略 | 说明 |
|---------|---------|------|
| **Bash** | 禁用 | 非技术用户不需要，安全风险极高 |
| **FileRead/Edit/Write** | 受限使用 | 路径限制在租户 workspace 内 |
| **Glob/Grep** | 受限使用 | 搜索范围限制在租户 workspace |
| **WebFetch/WebSearch** | 按配置开启 | 租户管理员决定是否允许 |
| **MCP** | 白名单制 | 只能调用租户注册的 MCP Server |
| **Agent（子Agent）** | 按配置开启 | 可选能力 |
| **TaskCreate/Update/List** | 启用 | Agent 内部任务管理 |
| **EnterPlanMode/ExitPlanMode** | 禁用 | 非技术用户不需要规划模式 |

### 4.3 API Key 安全

租户的 LLM API Key 是最高敏感度数据，需要明确隔离策略：

| 阶段 | 存储方式 | 运行时行为 |
|------|---------|-----------|
| MVP | PG 加密存储（AES-256-GCM），加密密钥通过环境变量注入 | 解密后仅存在于 Session 级别的 Provider 闭包内，不被全局缓存 |
| 规模化 | 接入 Vault/KMS 等专业密钥管理服务 | 引擎实例通过 Vault 动态获取，不持久化明文 |

**MVP 的安全边界**：同一引擎实例内，不同 Session 的 API Key 存在不同的 Provider 实例闭包中。JavaScript 的闭包隔离提供了基本的防护，但不防范恶意代码级别的攻击（需容器隔离解决）。

### 4.4 规模化阶段：容器级隔离

当租户数超过 10 个时，需要引入容器级隔离：
- 每个引擎实例在独立 Docker 容器中运行
- 每个容器只服务一个租户的 Session
- Kubernetes 调度，网络策略限制跨租户访问
- 文件系统通过 volume mount 隔离

---

## 5. Skill / MCP / 配置管理

### 5.1 Agent 模板（核心配置实体）

```typescript
interface AgentTemplate {
  id: string
  tenantId: string
  name: string                    // "客服助手"
  description: string             // "处理客户咨询、退换货、投诉"

  // 大脑配置
  systemPrompt: string            // 系统提示词
  model: {
    provider: ProviderType        // anthropic | openai | ...
    model: string                 // claude-sonnet-4-6 | gpt-4o | ...
    temperature: number
    maxTokens: number
  }

  // 能力配置
  tools: string[]                 // 启用的工具列表
  skills: SkillRef[]              // 挂载的 Skill
  mcpServers: MCPServerRef[]      // 连接的 MCP Server

  // 约束配置
  constraints: {
    maxTokensPerTurn: number
    maxTurnsPerSession: number
    maxConcurrentSessions: number
  }
}
```

### 5.2 配置到 SDK 的映射

```
AgentTemplate                       SDK 调用
───────────                         ─────────
systemPrompt                   →    engine.createSession({ systemPrompt })
model                          →    per-session Provider 覆盖
tools                          →    TenantPermissionDelegate 白名单
skills                         →    SkillLoader 按配置加载
mcpServers                     →    per-session MCP Client 配置
constraints.maxTokensPerTurn   →    TokenBudgetManager 预算设置
```

### 5.3 MCP Server 管理

**MVP 阶段**：
- 租户管理员在平台上注册 MCP Server 连接信息（URL + auth config）
- 平台存储 MCP Server 元数据到 PostgreSQL
- SDK 侧的 MCP Client 按 per-session 配置连接

**规模化阶段**：
- 平台提供 MCP Server 托管运行能力
- 每个 MCP Server 在租户隔离的容器中运行
- 健康检查 + 自动重启

### 5.4 Skill 管理

- 平台提供系统级 Skill（内置模板）
- 租户可上传自定义 Skill（Markdown 格式的 SKILL.md）
- Skill 存储在 PG，按 tenantId 隔离
- SDK 侧通过 SkillLoader 按配置加载

---

## 6. 存储设计

### 6.1 PostgreSQL（持久化存储）

```
核心表：
├── tenants          租户信息、配额、计费规则
├── users            用户信息、角色、所属租户
├── agent_templates  Agent 模板配置（systemPrompt/tools/skills/MCP）
├── skills           Skill 定义（按租户隔离）
├── mcp_registrations MCP Server 注册信息
├── sessions         Session 元数据（状态/归属/token用量）
├── messages         对话内容（替代 SDK 的 transcript.jsonl）
└── billing_records  计费记录
```

**核心表关键字段定义**：

```sql
-- sessions 表
CREATE TABLE sessions (
  id            UUID PRIMARY KEY,
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  user_id       UUID NOT NULL REFERENCES users(id),
  template_id   UUID REFERENCES agent_templates(id),
  engine_id     TEXT,                          -- 分配到的引擎实例 ID
  status        TEXT NOT NULL DEFAULT 'created', -- created/running/paused/terminated
  workspace     TEXT NOT NULL,                  -- 租户隔离的工作目录
  token_usage   JSONB DEFAULT '{}',             -- { inputTokens, outputTokens, totalCost }
  config_snapshot JSONB,                        -- 创建时的 AgentTemplate 快照
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_sessions_tenant_status ON sessions(tenant_id, status);
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- messages 表（对话内容，按 session 分组）
CREATE TABLE messages (
  id            BIGSERIAL PRIMARY KEY,
  session_id    UUID NOT NULL REFERENCES sessions(id),
  seq_num       INTEGER NOT NULL,               -- 消息序号（turn 内递增）
  role          TEXT NOT NULL,                   -- user/assistant/tool/system
  content       JSONB NOT NULL,                  -- 消息内容（文本/工具调用/工具结果）
  token_count   INTEGER,                         -- 该消息的 token 数
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_messages_session_seq ON messages(session_id, seq_num);

-- agent_templates 表
CREATE TABLE agent_templates (
  id            UUID PRIMARY KEY,
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  name          TEXT NOT NULL,
  description   TEXT,
  system_prompt TEXT NOT NULL,
  model_config  JSONB NOT NULL,                  -- { provider, model, temperature, maxTokens }
  tools         JSONB DEFAULT '[]',              -- 启用的工具列表
  skills        JSONB DEFAULT '[]',              -- Skill 引用列表
  mcp_servers   JSONB DEFAULT '[]',              -- MCP Server 引用列表
  constraints   JSONB DEFAULT '{}',              -- { maxTokensPerTurn, maxTurnsPerSession, ... }
  version       INTEGER DEFAULT 1,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_templates_tenant ON agent_templates(tenant_id, is_active);
```

### 6.2 Redis（热数据/缓冲）

```
├── session:{id}:events     SSE 事件缓冲（用于断线重连）
├── tenant:{id}:quota       租户实时配额计数器
├── session:{id}:lock       Session 分布式锁
├── user:{id}:online        用户在线状态
└── engine:{id}:health      引擎实例健康状态
```

### 6.3 与 SDK 存储接口的映射

| SDK 接口 | Neptune-AI 实现 | 存储位置 |
|---------|----------------|---------|
| `ISessionStore` | `PgSessionStore` | PostgreSQL |
| `ISessionContentStore` | `PgContentStore` | PostgreSQL |
| `IMemoryStore` | `RedisMemoryStore` | Redis |
| `IBackend<T>` | `PgBackend<T>` / `RedisBackend<T>` | PG / Redis |

---

## 7. SDK 改造范围

### 7.1 必须做的（Phase 0）

| 改造项 | 说明 | 工作量估算 |
|--------|------|-----------|
| `PgSessionStore` | 实现 ISessionStore 的 PostgreSQL 驱动 | 中 |
| `PgContentStore` | 实现 ISessionContentStore 的 PostgreSQL 驱动 | 中 |
| `RedisMemoryStore` | 实现 IMemoryStore 的 Redis 驱动。使用 Redis Hash 按 userId 隔离（`hset/hget/hdel`），避免 SCAN 的性能问题 | 小 |
| `EventBus 外部订阅` | 允许编排层订阅 EventBus 事件（当前仅支持引擎内部订阅） | 小 |
| `Session 快照验证` | SDK 已有 `Session.toSnapshot()`/`restore()` + `SQLiteSessionStore`。需验证现有快照机制是否满足跨进程恢复需求（序列化完整性、数据一致性），必要时扩展 | 小 |

> **注意**：Session 脱水/复水 SDK 已有基础实现（`SessionSnapshot`/`EngineSnapshot`/`SessionContextSnapshot` 类型 + `restoreSessionContextFromSnapshot()` 函数），不需要从零构建。Phase 0 重点是**验证**这些机制在 PG 驱动下能否正确恢复，而非重建。

### 7.2 建议做的（Phase 0 或 Phase 1）

| 改造项 | 说明 |
|--------|------|
| `toolsets` 增强 | 支持按 AgentTemplate 配置动态加载工具集 |
| `PermissionDelegate 增强` | 支持路径重写（tenant workspace 前缀注入） |
| `MCP per-session 配置` | 已有接口，确保可从外部传入 MCP Server 列表 |

### 7.3 不做的

- SDK 核心不引入租户概念（tenantId 等）
- 不修改 Agent Loop 核心逻辑
- 不修改 QueryEngine / query.ts
- 不在 SDK 内实现 HTTP/SSE/WebSocket

---

## 8. 编排层新建范围

### 8.1 模块清单

| 模块 | 职责 | 技术选型 |
|------|------|---------|
| **API Server** | HTTP 路由、中间件、请求处理 | Fastify |
| **Auth** | 用户登录、JWT 签发、OAuth2 SSO | jsonwebtoken + simple-oauth2 |
| **TenantManager** | 租户 CRUD、配额规则管理 | PostgreSQL |
| **UserManager** | 用户 CRUD、角色分配 | PostgreSQL |
| **ConfigManager** | AgentTemplate CRUD、版本管理 | PostgreSQL |
| **SkillRegistry** | Skill 注册、分发 | PostgreSQL + 文件系统 |
| **MCPRegistry** | MCP Server 注册、连接管理 | PostgreSQL |
| **SessionRouter** | Session 分配到引擎实例、生命周期管理 | Redis + PG |
| **SSE Bridge** | EventBus → SSE 事件桥接 + Redis 缓冲 | Fastify SSE |
| **CostAggregator** | 订阅 EventBus，聚合 token 用量，入计费 | EventBus + PG |
| **HealthMonitor** | 引擎实例健康检查、告警 | 定时心跳 |

### 8.2 关键数据流

**用户发送消息的完整流程：**

```
1. 桌面端 POST /api/sessions/:id/messages
   Body: { content: "帮我分析这份报告" }
   Header: Authorization: Bearer <jwt>

2. 编排层 API Server
   a. 验证 JWT → 获取 userId, tenantId
   b. 检查配额（Redis 计数器）
   c. 查找 Session 归属的引擎实例
   d. 调用 engine.query(sessionId, content)

3. 执行引擎层 SDK
   a. Agent 接收消息
   b. 开始 Agent Loop（LLM 调用 → 工具调用 → 循环）
   c. 每个步骤发出 EventBus 事件

4. 编排层 SSE Bridge
   a. 订阅 EventBus 事件
   b. 写入 Redis 缓冲区（用于断线重连）
   c. 推送到 SSE 流

5. 桌面端 SSE Client
   a. 收到 agent_thinking → 显示思考状态
   b. 收到 agent_text → 流式渲染文字
   c. 收到 tool_call → 显示工具调用
   d. 收到 query_complete → 更新 token 用量显示

6. 编排层 CostAggregator
   a. 收到 query_complete 事件
   b. 聚合到 tenant 的计费记录
   c. 更新 Redis 配额计数器
```

---

## 9. 桌面端 APP

### 9.1 技术栈

| 组件 | 选型 | 理由 |
|------|------|------|
| **框架** | Tauri | 小包体（~10MB）、macOS 原生体验、Rust 安全 |
| **前端** | React + TypeScript | 与服务端技术栈一致 |
| **UI 组件** | shadcn/ui + Radix | 轻量、可定制、TypeScript 原生 |
| **通信** | EventSource API (SSE) + fetch (HTTP POST) | 浏览器原生支持 |

### 9.2 核心功能

- Agent 配置界面：可视化配置 systemPrompt、工具、Skill、MCP
- Agent 对话界面：SSE 流式渲染（思考/文字/工具调用）
- Session 管理：创建/切换/销毁对话
- 用量展示：token 消耗、费用统计
- 租户管理（管理员）：用户管理、配额设置

---

## 10. 实施路径

### Phase 0: SDK 状态外化 (4-6 周)

**目标**：让 SDK 的 Session 状态可外部化，支持进程重启后恢复

- PgSessionStore 实现
- PgContentStore 实现
- RedisMemoryStore 实现
- Session 脱水/复水机制
- EventBus 外部订阅接口
- 集成测试（PG + Redis 环境）

**门禁**：Session 在引擎重启后可从 PG 恢复到上一个完整 turn

### Phase 1: 编排层核心 (4-6 周)

**目标**：构建平台核心服务，支持 3-5 个租户的 Agent 创建和运行

- Bun + Fastify 项目搭建
- PostgreSQL 数据库 schema
- 认证 (JWT)
- 租户/用户管理 CRUD
- Agent Template CRUD
- Session 生命周期管理
- SSE Bridge (EventBus → SSE)
- CostAggregator（基础计费）

**门禁**：通过 HTTP API 创建 Session、发送消息、接收 SSE 流式响应

### Phase 2: 桌面端 + 集成 (4-6 周)

**目标**：完整的端到端体验

- Tauri 项目搭建
- React UI（Agent 配置 + 对话）
- SSE 通信层 + 断线重连
- MCP Server 注册界面
- Skill 注册界面
- 端到端集成测试

**门禁**：非技术用户可通过桌面端 APP 配置 Agent 并与之对话

### Phase 3: 企业级加固 (持续)

**目标**：支撑 50+ 租户、1000+ 并发 Session

- 容器级隔离（Docker/K8s）
- 多引擎实例调度
- OTLP/Prometheus 可观测性
- 计费引擎完善（账单、用量报表）
- OAuth2 SSO 集成
- 压力测试 + 性能基线

---

## 11. 技术栈汇总

| 层 | 技术 | 版本 |
|----|------|------|
| 桌面端框架 | Tauri | 最新稳定版 |
| 桌面端前端 | React + TypeScript | 18+ / 5+ |
| 编排层运行时 | Bun | 1.x |
| 编排层 HTTP | Fastify | 5.x |
| 执行引擎 | Agent Engine SDK (claude-code) | 当前版本 |
| 关系数据库 | PostgreSQL | 16+ |
| 缓存 | Redis | 7+ |
| 认证 | JWT (jose) + simple-oauth2 | - |
| ORM | Drizzle | 轻量、类型安全、Bun 兼容性好、SQL-like API |
| 部署 | Docker + Docker Compose (MVP) | - |

---

## 12. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| SDK 状态外化改造引入 bug | 高 | 渐进式替换，保持 InMemory 实现作为 fallback |
| LLM API 延迟导致 SSE 超时 | 中 | SSE 心跳 + 合理的超时配置 |
| 多租户 Session 资源竞争 | 中 | TokenBudgetManager + 租户级配额 |
| MCP Server 安全隔离不足 | 高 | MVP 用 PermissionDelegate 白名单，规模化用容器隔离 |
| PG 写入瓶颈（高频对话内容） | 低 | 先写 Redis，异步批量刷入 PG |

---

## 13. 容错与降级策略

| 故障场景 | 影响 | 处理策略 |
|---------|------|---------|
| **引擎实例崩溃** | 该实例上所有进行中的 turn 丢失 | 编排层通过健康检测发现崩溃 → 标记受影响的 session 为 `orphaned` → 从 PG 恢复到上一个完整 turn → 分配到新的引擎实例 → 通知客户端"上次操作未完成，已恢复" |
| **编排层调用 engine.query() 时引擎无响应** | 用户消息无法送达 | 设置 query 调用超时（如 30s）→ 超时后标记 session 为 `error` → SSE 推送 error 事件给客户端 |
| **Redis 不可用** | SSE 断线重连失效、配额计数器丢失 | SSE 降级为无缓冲模式（断线重连不支持）、配额降级为 PG 慢查询、分布式锁降级为 PG advisory lock |
| **PG 写入失败** | 对话内容可能丢失 | 消息先写 Redis（WAL 模式），异步重试 PG 写入。如果 Redis 也失败，消息存在 SDK 进程内存中，引擎关闭前 flush |
| **LLM Provider API 超时/限流** | Agent 响应变慢或失败 | SDK 已有 CircuitBreaker 机制（closed → open → half-open）→ open 状态时快速失败 → SSE 推送 error 事件 |
| **SSE 连接意外断开** | 客户端丢失实时事件 | Redis 缓冲区保留最近 1000 条事件（TTL 5 分钟）→ 客户端用 Last-Event-ID 重连 → 补发缺失事件 |
