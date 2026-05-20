# Neptune-AI 服务器

Neptune-AI 平台服务的编排层，基于 Bun + Fastify + PostgreSQL + Redis 构建。

## 项目结构

```
neptune-ai/server/
├── package.json              # 项目依赖和脚本
├── tsconfig.json             # TypeScript 配置
├── drizzle.config.ts         # Drizzle ORM 配置
├── docker-compose.yml        # PostgreSQL + Redis 开发环境
├── .env.example              # 环境变量示例
├── src/
│   ├── index.ts              # Fastify 入口
│   ├── config.ts             # 环境变量配置
│   ├── db/
│   │   ├── index.ts          # Drizzle PG 连接
│   │   ├── schema.ts         # 所有表定义
│   │   └── migrations/       # 数据库迁移文件
│   ├── routes/               # 路由定义
│   ├── services/             # 业务逻辑
│   └── middleware/           # 中间件
└── test/
    ├── main.test.ts          # 测试入口
    └── README.md             # 测试说明
```

## 快速开始

### 1. 安装依赖

```bash
bun install
```

### 2. 启动数据库

```bash
docker-compose up -d
```

### 3. 配置环境变量

```bash
cp .env.example .env
# 根据需要修改 .env 文件
```

### 4. 运行测试

```bash
bun test
```

### 5. 启动开发服务器

```bash
bun run dev
```

服务器将在 `http://localhost:3000` 启动。

## 数据库 Schema

### 核心表 (8 张)

- **tenants**: 租户信息、配额、计费规则
- **users**: 用户信息、角色、所属租户
- **agent_templates**: Agent 模板配置（systemPrompt/promptConfig/tools/skills/MCP）
- **sessions**: Session/Thread 元数据（状态/归属/workspace）
- **billing_records**: 计费记录（token 用量 + 费用）
- **documents**: Agent 文档/知识库/记忆文件
- **skills**: 技能模板（租户级）
- **agent_skills**: Agent-Skill 多对多关联

## API 端点

### 健康检查

- `GET /health` - 服务器健康状态
- `GET /health/db` - 数据库连接状态

## 技术栈

- **运行时**: Bun 1.x
- **HTTP 框架**: Fastify 5.x
- **数据库**: PostgreSQL 16+
- **缓存**: Redis 7+
- **ORM**: Drizzle ORM
- **认证**: JWT (jose)
- **测试**: bun:test

## 开发规范

- 所有代码使用 TypeScript 编写
- 遵循 TDD 开发方式：先写测试，再写实现
- 使用中文注释
- 所有函数和复杂逻辑必须有 JSDoc 注释

## 已实现模块

- ✅ 认证模块 (JWT + bcrypt)
- ✅ 租户/用户/Agent 模板 CRUD
- ✅ Thread 生命周期 + SSE 流式对话
- ✅ Session 兼容层（委托 ThreadManager）
- ✅ CostAggregator 计费
- ✅ Skills CRUD + Agent-Skill 关联
- ✅ 文档/知识库管理
- ✅ Plan Mode（PlanManager 任务计划可视化）
- ✅ Langfuse 可观测性集成
- ✅ Prompt 模块化组装（PromptAssembler）
