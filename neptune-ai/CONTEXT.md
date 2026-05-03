# Neptune AI — 企业 AI 平台

## 这是什么？

培养专属 AI 员工的企业平台。目标用户是非技术业务人员，通过配置 Agent 模板（岗位说明书）、接入企业数据，让 Agent 上岗工作。

## 为什么存在？

将 neptune-engine SDK 的能力包装为面向企业的 SaaS 产品，降低 AI Agent 的使用门槛。

## 边界

**负责：** Agent 模板管理、Session 生命周期编排、用户与权限、MCP Server 注册、用量与计费
**不负责：** Agent 如何思考（prompt）、工具如何执行（SDK）、MCP Server 运行时

## 依赖

- 依赖 `neptune-engine/`（SDK）
- 依赖 `shared/`（共享类型）

## 关键目录

- `server/` — 后端编排层（[子 context](server/CONTEXT.md)）
- `desktop/` — 前端桌面端（[子 context](desktop/CONTEXT.md)）
- `docs/` — 产品设计文档

## 如何开发

```bash
# 后端
cd neptune-ai/server
docker-compose up -d    # PostgreSQL + Redis
bun install && bun run dev

# 前端
cd neptune-ai/desktop
bun install && bun run dev
```
