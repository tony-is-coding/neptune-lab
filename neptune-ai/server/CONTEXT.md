# Server — 后端编排层

Bun + Fastify 编排层。管编排不管执行。Agent 是产品的一等公民，一个 Agent = 一个持续对话流。

核心技术栈：Bun 1.x、Fastify 5.x、PostgreSQL 16+ (Drizzle ORM)、Redis 7+

关键文件：
- `src/services/session.ts` — QueryDispatcher，核心调度器
- `src/services/permission-delegate.ts` — 租户权限隔离
- `src/db/schema.ts` — Drizzle ORM 全部表定义
