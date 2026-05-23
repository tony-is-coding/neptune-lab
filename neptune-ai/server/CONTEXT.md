# Server — 后端编排层

Bun + Fastify 编排层。管编排不管执行。Agent 是产品的一等公民。

核心技术栈：Bun 1.x、Fastify 5.x、PostgreSQL 16+ (Drizzle ORM)、Redis 7+

## 核心服务

| 服务 | 文件 | 职责 |
|------|------|------|
| ThreadManager | `src/services/thread-manager.ts` | Thread CRUD + Engine dispatch（核心调度器） |
| EngineFactory | `src/services/engine-factory.ts` | 创建 AgentEngine 实例（LRU 池管理） |
| PromptAssembler | `src/services/prompt-assembler.ts` | 模块化 System Prompt 组装（6 个 Block） |
| SSEEventMapper | `src/services/sse-event-mapper.ts` | SDK 事件 → 前端 SSE 事件映射 |
| HistoryTransformer | `src/services/history-transformer.ts` | transcript.jsonl → 前端 blocks 结构 |
| PlanManager | `src/services/plan/PlanManager.ts` | Plan 状态管理（TaskCreate/TaskUpdate → SSE Plan 事件） |
| PermissionDelegate | `src/services/permission-delegate.ts` | 租户权限隔离（工具白名单 + 路径限制） |
| Observability | `src/services/observability/` | Langfuse 可观测性（ITracingProvider 实现） |

## 关键文件

- `src/index.ts` — Fastify 入口，路由注册，环境变量覆盖
- `src/db/schema.ts` — Drizzle ORM 全部 8 张表定义
- `src/middleware/auth.ts` — JWT 认证中间件
- `src/config.ts` — 环境变量统一管理

## 路由 (前缀 /api/v1)

| 路由文件 | 前缀 | 端点数 |
|----------|------|--------|
| auth.ts | /auth | 登录/注册 |
| tenants.ts | /tenants | 租户 CRUD |
| users.ts | /users | 用户 CRUD |
| agents.ts | /agents | Agent 模板 CRUD + 文档管理 |
| threads.ts | /agents/:agentId/threads | Thread CRUD + Chat(SSE) + History |
| sessions.ts | /agents/:agentId | 旧兼容接口（委托 ThreadManager） |
| billing.ts | /tenants/:tenantId/billing | 计费记录 |
| skills.ts | /skills | 技能 CRUD |
