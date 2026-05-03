# Neptune-AI 系统架构文档

> 基于 neptune-ai/ 目录代码实际分析，反映当前实现状态
> 更新日期：2026-05-01

---

## 1. 系统全景

Neptune-AI 是一个面向企业业务人员的 **Agent 配置与运行平台**。核心定位：非技术用户通过配置 Agent 模板（岗位说明书）、接入企业数据，让 Agent 上岗工作。

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Neptune-AI 系统全景                           │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    Desktop APP (Tauri v2)                     │   │
│  │              React 19 + Vite 7 + Tailwind CSS v4             │   │
│  └────────────┬──────────────────────────────────┬──────────────┘   │
│               │ REST (JSON)                       │ SSE (Stream)     │
│               ▼                                    ▼                  │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                Server 编排层 (Bun + Fastify 5.x)              │   │
│  │     ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │   │
│  │     │ Auth     │ │ Agent    │ │ Session  │ │ Billing      │  │   │
│  │     │ Module   │ │ CRUD     │ │ Dispatch │ │ Aggregator   │  │   │
│  │     └──────────┘ └──────────┘ └─────┬────┘ └──────────────┘  │   │
│  └────────────────────────────────────┬─────────────────────────┘   │
│                                       │ 进程内 API 调用              │
│                                       ▼                              │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │            Agent Engine (claude-code SDK)                     │   │
│  │        每 Query 创建/销毁，无状态化运行                         │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐ │
│  │ PostgreSQL   │  │ Redis       │  │ 文件系统                     │ │
│  │ 16 (5433)   │  │ 7 (6380)    │  │ /data/tenants/{tid}/...     │ │
│  │ 业务数据     │  │ 配额/缓冲   │  │ 对话/记忆/文档               │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. 技术栈总览

### 2.1 后端技术栈 (server/)

| 层次 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 运行时 | Bun | 1.x | JS/TS 运行时、包管理、测试框架 |
| HTTP 框架 | Fastify | 5.2.x | Web 服务器、路由、插件体系 |
| ORM | Drizzle ORM | 0.36.x | 类型安全 SQL 查询构建 |
| 数据库驱动 | postgres.js | 3.4.x | PostgreSQL 连接（连接池 max=10） |
| 数据库 | PostgreSQL | 16 Alpine | 关系型业务数据存储 |
| 缓存 | Redis | 7 Alpine (ioredis 5.5.x) | 实时配额计数、SSE 断线缓冲 |
| 认证 | jose | 6.0.x | JWT 签发/验证（HS256） |
| 密码 | bcrypt | 6.0.x | 密码哈希 |
| 验证 | zod | 4.3.x | Schema 验证（已引入，待充分使用） |
| Agent SDK | claude-code-best | workspace:* | Agent Engine（本地 workspace 引用） |
| 容器化 | Docker Compose | 3.8 | 开发环境基础设施 |

### 2.2 前端技术栈 (desktop/)

| 层次 | 技术 | 版本 | 用途 |
|------|------|------|------|
| UI 框架 | React | 19.1.0 | 组件化 UI |
| 构建工具 | Vite | 7.0.4 | 开发服务器 + 生产构建 |
| CSS 方案 | Tailwind CSS | 4.2.4 | 原子化 CSS（@tailwindcss/vite 插件） |
| 路由 | react-router-dom | 7.14.2 | 客户端路由 |
| 状态管理 | Zustand | 5.0.12 | 全局状态（persist 中间件） |
| HTTP 客户端 | Axios | 1.15.2 | API 请求 |
| 桌面端 | Tauri v2 | 2.x | Rust 壳，CSP 安全策略 |
| Markdown | react-markdown + rehype/remark 插件 | 10.1.0 | 消息内容渲染 |
| 字体 | Plus Jakarta Sans | 4 字重 | 品牌字体（本地化） |
| E2E 测试 | Playwright | 1.59.1 | 前端自动化测试 |

### 2.3 测试技术栈

| 层次 | 技术 | 覆盖范围 |
|------|------|---------|
| 后端单元测试 | bun:test | 项目搭建、认证、CRUD、API 集成（~94 用例） |
| 后端 E2E | Shell 脚本 (e2e-smoke.sh) | 15 步完整用户旅程 |
| 前端 E2E | Playwright | smoke/login/navigation/ui-visual（~25 用例） |

---

## 3. 系统分层架构

```
                    ┌─────────────────────────────────┐
                    │          用户浏览器/桌面端         │
                    └──────────────┬──────────────────┘
                                   │
                    ┌──────────────▼──────────────────┐
                    │       Tauri v2 桌面应用壳         │
                    │    (Rust, CSP 安全策略, 窗口管理)  │
                    └──────────────┬──────────────────┘
                                   │
         ╔═════════════════════════╧═════════════════════════╗
         ║              前端应用层 (React 19)                  ║
         ║                                                      ║
         ║  ┌──────────┐ ┌──────────┐ ┌──────────┐           ║
         ║  │ Pages    │ │ Comp.    │ │ Stores   │           ║
         ║  │ 12 页面   │ │ 4 公共   │ │ 1 Auth   │           ║
         ║  └──────────┘ └──────────┘ └──────────┘           ║
         ║  ┌──────────┐ ┌──────────┐ ┌──────────┐           ║
         ║  │ API 层   │ │ Hooks    │ │ Types    │           ║
         ║  │ Axios+SSE│ │ useSSE   │ │ TS 定义  │           ║
         ║  └──────────┘ └──────────┘ └──────────┘           ║
         ╚═══════════════════╤═══════════════════════════════╝
                             │ REST (JSON) + SSE (Stream)
         ╔═══════════════════╧═══════════════════════════════╗
         ║              后端编排层 (Bun + Fastify)             ║
         ║                                                      ║
         ║  ┌─────────────────────────────────────────────┐   ║
         ║  │           路由层 (7 组路由)                    │   ║
         ║  │  auth │ tenants │ users │ agents │ sessions   │   ║
         ║  │              │ billing                       │   ║
         ║  └──────────────────────┬──────────────────────┘   ║
         ║                         │                           ║
         ║  ┌──────────────────────▼──────────────────────┐   ║
         ║  │           服务层 (7 个 Service)               │   ║
         ║  │  AuthService │ TenantService │ UserService    │   ║
         ║  │  AgentTemplateService │ SessionService        │   ║
         ║  │  (QueryDispatcher) │ CostService              │   ║
         ║  │  PermissionDelegate                            │   ║
         ║  └──────────────────────┬──────────────────────┘   ║
         ║                         │                           ║
         ║  ┌──────────────────────▼──────────────────────┐   ║
         ║  │           数据层 (6 张表 + Redis)             │   ║
         ║  │  Schema: tenants/users/agent_templates/      │   ║
         ║  │          sessions/billing_records/documents  │   ║
         ║  └─────────────────────────────────────────────┘   ║
         ╚═══════════════════╤═══════════════════════════════╝
                             │ 进程内 API
         ╔═══════════════════╧═══════════════════════════════╗
         ║              Agent Engine 层 (claude-code SDK)     ║
         ║                                                      ║
         ║  AgentEngine.create() ──> engine.query()           ║
         ║  → AsyncGenerator<Event> ──> engine.destroy()      ║
         ║                                                      ║
         ║  每 Query 创建/销毁，无状态化运行                    ║
         ╚════════════════════════════════════════════════════╝
```

---

## 4. 核心模块详解

### 4.1 前端页面架构

```
┌─ App.tsx (BrowserRouter) ──────────────────────────────────────────┐
│                                                                     │
│  公开路由:                                                           │
│    /login  ──────────── Login (登录/注册切换)                        │
│                                                                     │
│  受保护路由 (ProtectedRoute → Layout 包裹):                          │
│  ┌─ Layout ──────────────────────────────────────────────────────┐ │
│  │  ┌──────────┐  ┌──────────────────────────────────────────┐  │ │
│  │  │ 侧边栏    │  │                主内容区                    │  │ │
│  │  │ 72px     │  │                                          │  │ │
│  │  │          │  │  /  或  /agents    → AgentList            │  │ │
│  │  │ Logo "N" │  │  /agents/create  → CreateAgent           │  │ │
│  │  │ Home     │  │  /agent/:id      → AgentChat             │  │ │
│  │  │ Agents   │  │  /agents/:id     → Templates (详情/编辑)  │  │ │
│  │  │ Skills   │  │  /skills         → SkillsHub             │  │ │
│  │  │ Collab   │  │  /collaborate    → Collaborate           │  │ │
│  │  │ ───────  │  │  /alerts         → Alerts (占位)          │  │ │
│  │  │ Alerts   │  │  /settings       → Settings (中转)       │  │ │
│  │  │ Settings │  │  /admin/users    → Users (CRUD)           │  │ │
│  │  │ ───────  │  │  /admin/billing  → Billing (计费)        │  │ │
│  │  │ [Avatar] │  │                                          │  │ │
│  │  └──────────┘  └──────────────────────────────────────────┘  │ │
│  └──────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 后端路由结构

```
/api/v1/                              # 业务 API 前缀
├── /auth                             # 认证模块
│   ├── POST   /login                 # 登录（accessToken + refreshToken）
│   ├── POST   /register              # 注册（双模式：加入/创建租户）
│   ├── POST   /token/refresh         # 刷新令牌
│   └── GET    /me                    # 当前用户信息
│
├── /tenants                          # 租户管理 [admin]
│   ├── POST   /                      # 创建租户
│   ├── GET    /                      # 列表（分页）
│   ├── GET    /:id                   # 详情
│   ├── PUT    /:id                   # 更新
│   ├── DELETE  /:id                  # 删除
│   └── GET    /:id/billing           # 租户账单汇总
│
├── /users                            # 用户管理
│   ├── POST   /                      # 创建用户 [admin]
│   ├── GET    /                      # 列表 [认证]
│   ├── GET    /:id                   # 详情 [认证]
│   ├── PUT    /:id                   # 更新 [admin]
│   └── DELETE  /:id                  # 删除 [admin]
│
└── /agents                           # Agent 管理
    ├── POST   /                      # 创建模板 [admin]
    ├── GET    /                      # 模板列表 [认证]
    ├── GET    /:id                   # 模板详情 [认证]
    ├── PUT    /:id                   # 更新模板 [admin]
    ├── PATCH  /:id/activate          # 激活 [admin]
    ├── PATCH  /:id/deactivate        # 停用 [admin]
    ├── DELETE  /:id                  # 删除模板 [admin]
    ├── GET    /:id/stats             # Agent 统计 [认证]
    ├── GET    /:id/documents         # 文档列表 [认证]
    ├── POST   /:id/documents         # 上传文档 [认证]
    ├── DELETE  /:id/documents/:docId # 删除文档 [admin]
    ├── POST   /:id/chat              # SSE 流式对话 [认证] ★核心端点
    └── GET    /:id/history           # 对话历史 [认证]

/health                               # 服务器健康检查
/health/db                            # 数据库健康检查
```

---

## 5. 数据模型

### 5.1 数据库 ER 图

```
┌──────────────────┐       ┌──────────────────┐
│     tenants      │       │      users       │
├──────────────────┤       ├──────────────────┤
│ id        UUID PK│──┐    │ id        UUID PK│
│ name      TEXT   │  │    │ tenant_id UUID FK│──→ tenants.id
│ quota     JSONB  │  │    │ name      TEXT   │
│ billing   JSONB  │  │    │ email     TEXT UQ│
│ created_at TS    │  │    │ password  TEXT   │
│ updated_at TS    │  │    │ role      TEXT   │
└──────────────────┘  │    │ created_at TS    │
                      │    └──────────────────┘
                      │
                      │    ┌──────────────────────────┐
                      │    │    agent_templates        │
                      │    ├──────────────────────────┤
                      ├──→ │ id            UUID PK     │
                      │    │ tenant_id     UUID FK     │──→ tenants.id
                      │    │ name          TEXT        │
                      │    │ description   TEXT        │
                      │    │ system_prompt TEXT        │
                      │    │ model_config  JSONB       │
                      │    │ tools         JSONB       │
                      │    │ skills        JSONB       │
                      │    │ mcp_servers   JSONB       │
                      │    │ constraints   JSONB       │
                      │    │ version       INT         │
                      │    │ is_active     BOOL        │
                      │    │ created_at / updated_at   │
                      │    └──────────────────────────┘
                      │
                      │    ┌──────────────────────────┐
                      │    │      sessions             │
                      │    ├──────────────────────────┤
                      ├──→ │ id            TEXT PK     │
                      │    │ tenant_id     UUID FK     │──→ tenants.id
                      │    │ user_id       UUID FK     │──→ users.id
                      │    │ template_id   UUID FK     │──→ agent_templates.id
                      │    │ status        TEXT        │
                      │    │ workspace     TEXT        │
                      │    │ last_active_at TS         │
                      │    └──────────────────────────┘
                      │
                      │    ┌──────────────────────────┐
                      │    │   billing_records         │
                      │    ├──────────────────────────┤
                      ├──→ │ id            BIGSERIAL PK│
                      │    │ tenant_id     UUID FK     │──→ tenants.id
                      │    │ session_id    TEXT        │──→ sessions.id
                      │    │ user_id       UUID FK     │──→ users.id
                      │    │ input_tokens  INT         │
                      │    │ output_tokens INT         │
                      │    │ model         TEXT        │
                      │    │ cost_cents    INT         │
                      │    │ created_at    TS          │
                      │    └──────────────────────────┘
                      │
                      │    ┌──────────────────────────┐
                      │    │     documents             │
                      │    ├──────────────────────────┤
                      └──→ │ id            UUID PK     │
                           │ template_id   UUID FK     │──→ agent_templates.id
                           │ tenant_id     UUID FK     │──→ tenants.id
                           │ name          TEXT        │
                           │ type          TEXT        │
                           │ size          INT         │
                           │ path          TEXT        │
                           │ uploaded_at   TS          │
                           └──────────────────────────┘
```

### 5.2 三层存储模型

```
┌─────────────────────────────────────────────────────────────────────┐
│                        三层存储架构                                   │
├─────────────────┬──────────────────┬───────────────────────────────┤
│   PostgreSQL    │     Redis        │        文件系统                │
├─────────────────┼──────────────────┼───────────────────────────────┤
│ tenants 表      │ 租户配额计数      │ /data/tenants/{tenantId}/     │
│ users 表        │ tenant:{id}:quota│   agents/{agentId}/           │
│ agent_templates │   (Hash)         │     users/{userId}/workspace/ │
│ sessions 表     │                  │       transcript.jsonl (对话)  │
│ billing_records │ SSE 断线缓冲     │     .claude/memory/ (记忆)    │
│ documents 表    │                  │   documents/ (上传文档)        │
├─────────────────┼──────────────────┼───────────────────────────────┤
│ 关系型、持久化   │ 实时、易失       │ 非结构化、持久化               │
│ Drizzle ORM     │ ioredis          │ Node fs                       │
│ 端口 5433       │ 端口 6380        │ 本地磁盘                      │
└─────────────────┴──────────────────┴───────────────────────────────┘
```

---

## 6. 通信协议

### 6.1 RESTful API（请求-响应）

```
Desktop APP                          Server
    │                                  │
    │  POST /api/v1/auth/login         │
    │  { email, password }             │
    │ ──────────────────────────────→  │
    │                                  │ 验证密码
    │                                  │ 签发 JWT
    │  200 OK                          │
    │  { user, accessToken, ... }      │
    │ ←──────────────────────────────  │
    │                                  │
    │  GET /api/v1/agents              │
    │  Authorization: Bearer <token>   │
    │ ──────────────────────────────→  │
    │                                  │
    │  200 OK                          │
    │  [{ id, name, description, ...}] │
    │ ←──────────────────────────────  │
```

### 6.2 SSE 流式对话（核心协议）

```
Desktop APP                          Server
    │                                  │
    │  POST /api/v1/agents/:id/chat    │
    │  Content-Type: application/json  │
    │  Authorization: Bearer <token>   │
    │ ──────────────────────────────→  │
    │                                  │ QueryDispatcher.dispatch()
    │                                  │  1. 查询 agent_template
    │                                  │  2. getOrCreateSession()
    │                                  │  3. AgentEngine.create()
    │                                  │  4. engine.query()
    │                                  │
    │  event: connected                │
    │  data: {"sessionId":"xxx"}       │
    │ ←──────────────────────────────  │
    │                                  │
    │  event: message                  │
    │  data: {"type":"text",           │
    │         "content":"正在分析..."}   │
    │ ←──────────────────────────────  │
    │                                  │
    │  event: message                  │
    │  data: {"type":"tool_use",       │
    │         "tool":"FileRead",       │
    │         "input":{...}}           │
    │ ←──────────────────────────────  │
    │                                  │
    │  event: message                  │
    │  data: {"type":"tool_result",    │
    │         "output":"文件内容..."}    │
    │ ←──────────────────────────────  │
    │                                  │
    │  event: done                     │
    │  data: {"usage":{...}}           │
    │ ←──────────────────────────────  │
    │                                  │ engine.destroy()
```

---

## 7. 安全架构

### 7.1 认证体系

```
┌─────────────────────────────────────────────────────────────┐
│                       JWT 认证流程                            │
│                                                             │
│  ┌──────────┐    email+password    ┌──────────────────┐     │
│  │  Client  │ ──────────────────→  │  POST /auth/login │     │
│  └──────────┘                      └────────┬─────────┘     │
│       │                                     │               │
│       │                            bcrypt.compare()          │
│       │                                     │               │
│       │                            jose.sign() × 2           │
│       │                                     │               │
│       │  ◄──── { accessToken(1h),           │               │
│       │          refreshToken(7d) }          │               │
│       │                                     │               │
│       │  后续请求:                            │               │
│       │  Authorization: Bearer <accessToken> │               │
│       │  ──────────────────────────→  authMiddleware         │
│       │                            jose.verify()             │
│       │                            注入 request.user          │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 租户隔离与权限控制

```
┌─────────────────────────────────────────────────────────────────┐
│                     多租户权限隔离                                │
│                                                                 │
│  ┌──── 路由层 ─────────────────────────────────────────────┐    │
│  │  authMiddleware → 注入 request.user.tenantId             │    │
│  │  roleMiddleware → 检查 admin/user 角色                   │    │
│  │  Service 查询自动按 tenantId 过滤                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌──── Agent 执行层 ───────────────────────────────────────┐    │
│  │  TenantPermissionDelegate (实现 SDK PermissionDelegate)  │    │
│  │                                                          │    │
│  │  ✗ 工具黑名单: Bash, EnterPlanMode, ExitPlanMode...     │    │
│  │  ✓ 工具白名单: AgentTemplate.tools 中声明的工具          │    │
│  │  ✓ 文件路径限制: 只能操作租户 workspace 内文件           │    │
│  │  ✓ MCP 白名单: 只能访问租户注册的 MCP Server             │    │
│  │  ★ 永远不返回 'ask' — 服务端无头模式                     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌──── 文件系统隔离 ───────────────────────────────────────┐    │
│  │  /data/tenants/{tenantId}/agents/{agentId}/users/...    │    │
│  │  每个租户独立目录树，互不可见                              │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. 核心运行时：QueryDispatcher

这是系统最核心的调度器，实现 **每 Query 创建/销毁 Engine** 的无状态模式。

```
POST /api/v1/agents/:id/chat
          │
          ▼
┌─ QueryDispatcher.dispatch() ─────────────────────────────────┐
│                                                               │
│  1. DB 查询 agent_template ──→ 获取模型配置/工具/约束         │
│                     │                                         │
│  2. getOrCreateSession()                                      │
│     ├─ 查找现有 session (userId + templateId)                 │
│     └─ 不存在 → 创建 session 记录 + workspace 目录            │
│                     │                                         │
│  3. new TenantPermissionDelegate(tenantId, template)          │
│     └─ 注入工具黑/白名单、路径限制、MCP 白名单                 │
│                     │                                         │
│  4. AgentEngine.create({                                      │
│       apiKey, model, systemPrompt,                            │
│       permissionDelegate,                                     │
│       workspacePath,                                          │
│       mcpServers, tools                                       │
│     })                                                        │
│                     │                                         │
│  5. engine.loadSession() 或 engine.createSession()            │
│     └─ 恢复历史对话上下文                                      │
│                     │                                         │
│  6. engine.setMemoryPath(memoryRoot)                          │
│     └─ 设置 Agent 工作记忆路径                                │
│                     │                                         │
│  7. engine.query(userMessage)                                 │
│     └─ AsyncGenerator<Event>                                  │
│         │                                                     │
│         ├── event → SSE "message" 推送                        │
│         ├── event → SSE "message" 推送                        │
│         └── complete → SSE "done" + 计费记录                  │
│                     │                                         │
│  8. engine.destroy()  ← 释放资源                              │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## 9. 双写计费模型

```
┌─────────────────────────────────────────────────────────┐
│                CostAggregator 双写策略                    │
│                                                         │
│  engine.query() 完成                                     │
│       │                                                 │
│       ▼                                                 │
│  recordUsage(sessionId, usage)                           │
│       │                                                 │
│       ├──→ PostgreSQL                                   │
│       │    INSERT billing_records                       │
│       │    (持久化账单，支持历史查询)                      │
│       │                                                 │
│       └──→ Redis                                        │
│            HINCRBY tenant:{id}:quota                    │
│            (实时配额计数，支持速率限制)                    │
│                                                         │
│  查询接口:                                               │
│    getTenantUsage()  → DB 聚合 (精确历史)               │
│    getQuotaCounter() → Redis HGETALL (实时计数)          │
│                                                         │
│  定价: input $3/M tokens, output $15/M tokens           │
└─────────────────────────────────────────────────────────┘
```

---

## 10. 前端状态管理

```
┌─────────────────────────────────────────────────────────────┐
│                    前端状态架构                               │
│                                                             │
│  ┌─ 全局状态 (Zustand + persist) ──────────────────────┐    │
│  │  AuthStore (src/stores/auth.ts)                     │    │
│  │  ┌──────────────────────────────────────────────┐   │    │
│  │  │ user: User | null                            │   │    │
│  │  │ token: string | null                         │   │    │
│  │  │ isAuthenticated: boolean                     │   │    │
│  │  │ ─────────────────────────────────            │   │    │
│  │  │ localStorage('neptune-auth') ◄──── persist   │   │    │
│  │  └──────────────────────────────────────────────┘   │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─ 页面级状态 (useState) ────────────────────────────┐    │
│  │  AgentChat: messages[], isLoading, selectedAgent   │    │
│  │  AgentList:  agents[], quickInput, selectedAgent   │    │
│  │  CreateAgent: formData, skills, tones              │    │
│  │  Collaborate: conversations[], messages[]          │    │
│  │  Users: users[], modalState, formData              │    │
│  │  Billing: billingData[], stats                     │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─ API 通信层 ──────────────────────────────────────┐    │
│  │  apiClient (Axios 单例)                            │    │
│  │  └─ 拦截器: 自动注入 Bearer Token                  │    │
│  │  └─ 拦截器: 401 → clearAuth + /login              │    │
│  │                                                    │    │
│  │  SSEClient (fetch + ReadableStream)                │    │
│  │  └─ 指数退避重连 (5次, 1s-30s)                     │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## 11. 部署架构

```
┌─ Docker Compose 开发环境 ────────────────────────────────┐
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  neptune-ai  │  │  PostgreSQL  │  │    Redis     │  │
│  │   Server     │  │  16 Alpine   │  │   7 Alpine   │  │
│  │  (Bun)       │  │              │  │              │  │
│  │  Port: 3000  │  │  Port: 5433  │  │  Port: 6380  │  │
│  │              │  │  DB: neptune │  │              │  │
│  │              │  │      _ai     │  │              │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                  │          │
│         └─────────────────┴──────────────────┘          │
│                      Docker Network                      │
│                                                          │
│  ┌──────────────┐                                        │
│  │  Desktop APP │  (Tauri 打包，独立运行)                 │
│  │  Port: 1420  │  → 连接 localhost:3000                 │
│  └──────────────┘                                        │
│                                                          │
│  ┌──────────────┐                                        │
│  │  文件系统     │  /data/tenants/{tenantId}/...          │
│  │  (Volume)    │  对话/记忆/文档持久化                    │
│  └──────────────┘                                        │
└──────────────────────────────────────────────────────────┘
```

---

## 12. 目录结构总览

```
neptune-ai/
├── CLAUDE.md                    # 项目开发规范
│
├── server/                      # 后端编排层
│   ├── src/
│   │   ├── index.ts             # Fastify 入口 + 路由注册
│   │   ├── config.ts            # 环境变量配置
│   │   ├── db/
│   │   │   ├── index.ts         # 数据库连接
│   │   │   └── schema.ts        # 6 张表定义
│   │   ├── middleware/
│   │   │   └── auth.ts          # JWT 认证/角色中间件
│   │   ├── routes/
│   │   │   ├── auth.ts          # 认证路由 (4 端点)
│   │   │   ├── tenants.ts       # 租户 CRUD (6 端点)
│   │   │   ├── users.ts         # 用户 CRUD (5 端点)
│   │   │   ├── agents.ts        # Agent 模板 + 文档 (12 端点)
│   │   │   ├── sessions.ts      # SSE 对话 + 历史 (2 端点)
│   │   │   └── billing.ts       # 计费查询 (1 端点)
│   │   ├── services/
│   │   │   ├── auth.ts          # JWT 签发/验证
│   │   │   ├── tenant.ts        # 租户 CRUD
│   │   │   ├── user.ts          # 用户 CRUD
│   │   │   ├── agent-template.ts # Agent 模板 CRUD + 统计
│   │   │   ├── session.ts       # QueryDispatcher (核心调度)
│   │   │   ├── cost.ts          # CostAggregator (双写计费)
│   │   │   └── permission-delegate.ts # 租户权限隔离
│   │   └── types/
│   │       ├── fastify.d.ts     # Fastify 类型扩展
│   │       └── modules.d.ts     # 第三方模块类型
│   ├── test/                    # 后端测试 (~94 用例)
│   ├── docker-compose.yml       # PostgreSQL + Redis
│   └── package.json             # 依赖 (7 生产 + 3 开发)
│
├── desktop/                     # 前端桌面端
│   ├── src/
│   │   ├── main.tsx             # React 入口
│   │   ├── App.tsx              # 路由配置 + ProtectedRoute
│   │   ├── index.css            # Tailwind token (20+ 自定义变量)
│   │   ├── api/
│   │   │   ├── client.ts        # Axios API 客户端 (单例)
│   │   │   └── sse.ts           # SSE 客户端 (指数退避重连)
│   │   ├── components/
│   │   │   ├── Layout.tsx       # 72px 侧边导航
│   │   │   ├── ErrorBoundary.tsx # 错误边界
│   │   │   ├── MessageBubble.tsx # 聊天消息气泡
│   │   │   └── ToolCallCard.tsx  # 工具调用卡片
│   │   ├── hooks/
│   │   │   └── useSSE.ts        # SSE React Hook
│   │   ├── pages/               # 12 个页面组件
│   │   ├── stores/
│   │   │   └── auth.ts          # Zustand auth store
│   │   └── types/
│   │       └── index.ts         # TS 类型定义
│   ├── src-tauri/               # Tauri v2 Rust 壳
│   ├── tests/                   # Playwright E2E (~25 用例)
│   ├── DESIGN.md                # UI 设计规范 (313 行)
│   └── package.json             # 依赖 (8 生产 + 9 开发)
│
├── test/
│   └── e2e-smoke.sh             # 后端 E2E 冒烟测试 (15 步)
│
└── docs/
    └── specs/                   # 设计规格文档
        ├── 2026-04-29-neptune-ai-platform-architecture.md
        ├── 2026-04-30-neptune-ai-product-blueprint.md
        ├── 2026-04-30-neptune-ai-technical-design.md
        └── neptune-ai-product-interaction.md
```

---

## 13. 架构演进状态

| 阶段 | 状态 | 内容 |
|------|------|------|
| Phase 0 | ✅ 已完成 | SDK 状态外化（PgSessionStore, RedisMemoryStore, EventBus） |
| Phase 1 | ✅ 已完成 | 编排层核心（Fastify + DB Schema + Auth + CRUD + SSE Bridge） |
| Phase 2A | ✅ 已完成 | 后端架构对齐（Engine 无状态化、QueryDispatcher 重写、Schema 简化） |
| Phase 2B | 🔄 进行中 | Tauri 桌面端（前端应用已搭建，12 页面 + E2E 测试） |
| Phase 2C | ⏳ 待开始 | 集成验证 |

### 已知技术债务

| 优先级 | 项目 | 说明 |
|--------|------|------|
| P0 | SSE 实际测试 | 当前仅验证格式，需真实 Claude API Key |
| P1 | Session 并发保护 | 同一 (userId, agentId) 并发请求可能 workspace 冲突 |
| P1 | 测试隔离 | 缺少数据库清理机制 |
| P2 | transcript.jsonl 读取 | GET /:agentId/history 当前返回空列表 |
| P2 | modelConfig 映射 | agent_templates.modelConfig → SDK discriminated union |
| P2 | 内存 Session 存储 | SessionService.sessions 是内存 Map，重启后丢失 |
| P3 | 速率限制 | 租户级 API 速率限制未实现 |
| P3 | SSE Hook 统一 | useSSE 已封装但页面未使用，内联了重复 SSE 逻辑 |
