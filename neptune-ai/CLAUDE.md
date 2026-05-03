# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 顶级规则

1、所有沟通过程、文档都必须使用中文

### 做事风格
在你做事前，需要反思，每一步都必须有足够的思考
1、你为什么要做这个, 一定要深度思考用户目标;
2、你的用户是谁? 用户会怎么使用你的产品?
3、你的用户/验收者、你的leader 如何在不了解你怎么做的情况下？能够验收你做的事情?
4、你当前在做的事情，是否遵循来项目长期目标、是否遵循你任务本身的目标?
5、一旦判断上下文接近上限了，触发/compact 压缩命令，避免系统死机
6、一定要确保所有细节都澄清后才开始干活，不要直接上来就写代码或者写文档

### 完成任何事情之后总结
1、你做了什么工作?
2、有什么新的feature加入了? 改变在哪里？
3、用户/我  要如何进行测试？

---

## 项目目标

Neptune-AI = 培养专属 AI 员工的企业平台。目标用户是非技术业务人员，通过配置 Agent 模板（岗位说明书）、接入企业数据，让 Agent 上岗工作。

核心架构：基于 claude-code agent framework（SDK）构建的 SaaS 编排层，管编排不管执行。Agent 是产品的一等公民，一个 Agent = 一个持续对话流。

产品边界：
- **管的**：Agent 模板管理、Session 生命周期编排、用户与权限、MCP Server 注册、用量与计费
- **不管的**：Agent 如何思考（prompt）、工具如何执行（SDK）、MCP Server 运行时

---

## 关键目录说明

```
neptune-ai/
├── server/          # 后端 — Bun + Fastify 编排层
│   ├── src/
│   │   ├── index.ts              # Fastify 入口，路由注册
│   │   ├── config.ts             # 环境变量配置
│   │   ├── db/
│   │   │   ├── schema.ts         # Drizzle ORM 全部表定义
│   │   │   └── index.ts          # 数据库连接
│   │   ├── routes/               # API 路由（auth, tenants, users, agents, sessions, billing）
│   │   ├── services/             # 业务逻辑层
│   │   │   ├── session.ts        # QueryDispatcher — 核心调度器（每 query 创建/销毁 Engine）
│   │   │   ├── permission-delegate.ts  # TenantPermissionDelegate — 租户权限隔离
│   │   │   ├── auth.ts           # JWT 认证服务
│   │   │   ├── cost.ts           # 计费服务
│   │   │   └── ...
│   │   └── middleware/auth.ts    # JWT 认证中间件
│   ├── test/                     # bun:test 测试
│   ├── docker-compose.yml        # PostgreSQL(5433) + Redis(6380)
│   └── .env.example              # 环境变量模板
├── desktop/          # 前端 — React + Vite + Tailwind + Tauri 桌面端
│   ├── src/
│   │   ├── api/
│   │   │   ├── client.ts         # Axios API 客户端（JWT 自动注入）
│   │   │   └── sse.ts            # SSE 客户端（指数退避重连）
│   │   ├── hooks/useSSE.ts       # SSE React Hook
│   │   ├── stores/auth.ts        # Zustand auth store（persist to localStorage）
│   │   ├── pages/                # 页面组件（Login, AgentList, AgentChat, CreateAgent, ...）
│   │   ├── components/           # 共享组件
│   │   └── types/index.ts        # TypeScript 类型定义
│   └── DESIGN.md                 # UI 设计系统规范（Anthropic/Claude 设计语言）
├── docs/             # 产品与技术设计文档
│   └── specs/                    # 产品蓝图、技术设计、架构设计
└── test/             # E2E 集成测试
    └── e2e-smoke.sh              # Shell 脚本式冒烟测试
```

---

## 常用开发命令

### Server（后端）

```bash
cd server

# 启动基础设施
docker-compose up -d                    # PostgreSQL :5433 + Redis :6380

# 安装依赖
bun install

# 启动开发服务器
bun run dev                             # http://localhost:3000

# 运行全部测试
bun test

# 运行单个测试文件
bun test test/main.test.ts

# 数据库迁移
bun run db:generate                     # 生成 migration
bun run db:migrate                      # 执行 migration
bun run db:studio                       # Drizzle Studio GUI
```

### Desktop（前端）

```bash
cd desktop

# 安装依赖
bun install

# 启动开发服务器
bun run dev                             # Vite http://localhost:1420

# 构建
bun run build                           # tsc + vite build

# Tauri 桌面端
bun run tauri dev                       # 启动 Tauri 开发模式
```

### E2E 测试

```bash
# 完整冒烟测试（需 server 运行中）
bash test/e2e-smoke.sh                  # 默认 http://localhost:3000
bash test/e2e-smoke.sh http://localhost:3000  # 指定 URL

# 前端 Playwright 测试
cd desktop
npx playwright test                     # 运行全部
npx playwright test --project=smoke     # 单项目
```

---

## 核心架构

### Engine 无状态化 — 每 Query 创建/销毁

```
用户发消息 → HTTP POST → QueryDispatcher.dispatch()
  → 查 agent_templates 表获取模板配置
  → getOrCreateSession()（查/建 sessions 记录 + workspace 目录）
  → 创建 TenantPermissionDelegate（工具白名单 + 路径限制）
  → AgentEngine.create() → engine.query() → SSE 流式返回
  → engine.destroy()
```

关键代码路径：`server/src/services/session.ts` 的 `QueryDispatcher` 类

### 三层存储模型

| 存储 | 存什么 | 不存什么 |
|------|--------|---------|
| **文件系统** (`/data/tenants/{tenantId}/`) | 对话内容(transcript.jsonl)、Agent 记忆(.claude/memory/)、工作文件 | 业务数据 |
| **PostgreSQL** | tenants, users, agent_templates, sessions, billing_records, documents | 对话内容、Agent 记忆 |
| **Redis** | Token 配额计数、SSE 断线缓冲 | 持久数据 |

### 租户权限隔离

`TenantPermissionDelegate`（实现 SDK 的 `PermissionDelegate` 接口）：
- 工具白名单（来自 AgentTemplate.tools）
- 文件路径限制（限制在租户 workspace 内）
- MCP Server 白名单
- 永远不返回 `'ask'`（服务端无头模式）

### API 路由结构

所有 API 在 `/api/v1/` 前缀下：
- `POST /auth/login`, `POST /auth/register`, `GET /auth/me`
- `GET/POST /tenants`, `GET/PUT/DELETE /tenants/:id`
- `GET/POST /users`, `GET/PUT/DELETE /users/:id`
- `GET/POST /agents`, `GET/PUT/DELETE /agents/:id`, `PATCH /agents/:id/activate|deactivate`
- `POST /agents/:agentId/chat`（SSE 流式）, `GET /agents/:agentId/history`
- `GET /tenants/:tenantId/billing`

### 前端核心数据流

- **Auth**: Zustand + persist → `localStorage('neptune-auth')` → `getStoredToken()` 供 Axios 拦截器读取
- **Chat**: `AgentChat` 页面直接用 `fetch` + `ReadableStream` 解析 SSE（不通过 `useSSE` hook）
- **API**: `APIClient` 单例，401 时自动清除 auth 并跳转 `/login`

### UI 设计系统

遵循 Anthropic/Claude 设计语言（详见 `desktop/DESIGN.md`）：
- 色调：暖色系中性色，parchment 背景 `#f5f4ed`，terracotta 品牌色 `#c96442`
- 字体：Serif 标题 + Sans 正文（生产环境用 Georgia / Arial 回退）
- Tailwind CSS v4 + Vite 插件集成
- 前缀 `np-` 的自定义颜色 token（如 `text-np-primary`, `text-np-text-muted`）

---

## 项目规范

### TDD 开发纪律

1. 先写测试，再写实现
2. 按照阶段进行开发，先思考这个阶段目标，设计阶段测试用例
3. 不为了"未来可能用到"增加额外抽象
4. 任何新增类型都以当前测试需要为准

### 验证原则

不接受"感觉没问题"，可接受的验证结论必须来自：
- 自动化测试结果
- 可重复的人工验收步骤
- 明确的阶段门禁结论

### 文档管理规范

*文档是最宝贵的资源，千万不要乱放、乱写，必须严谨，讲究事实，可靠*

- 产品设计文档：`docs/design/`
- 研究文档/过程文档：`research-docs/`
- 临时文档：`.tmp_docs/`

### 开发技术框架

- **后端框架**: claude-code agent framework (`../claude-code`) — 通过 `claude-code-best` workspace 依赖引用
- **运行时**: Bun 1.x
- **HTTP**: Fastify 5.x
- **数据库**: PostgreSQL 16+ (Drizzle ORM)
- **缓存**: Redis 7+
- **前端**: React 19 + Vite 7 + Tailwind CSS v4 + Tauri v2
- **认证**: JWT (jose)
- **测试**: bun:test (server) + Playwright (desktop)
