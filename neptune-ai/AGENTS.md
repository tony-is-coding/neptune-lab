# Neptune AI 规则

## 范围

- 本产品负责围绕 AI 员工的 SaaS 体验：模板、session、用户/权限、MCP 注册、用量、计费、服务端编排、Web UI 和桌面壳。
- 本产品不负责 agent 推理内核、SDK 工具执行或 MCP runtime 行为；这些属于 `../neptune-engine/`。

## 必读上下文

- 大范围产品改动前读取 `CONTEXT.md`。
- UI 工作前读取 `DESIGN.md`。
- 服务端工作按需读取 `server/CONTEXT.md`。

## 前端

- 修改 `web/src/**` 前，必须使用 `frontend-design` 技能。
- 前端改动影响 auth、agents、navigation、chat、SSE 或渲染时，使用 `e2e-testing` 技能验证。
- 不要创建营销页或 landing page 风格 UI，除非用户明确要求。
- UI 需要符合现有设计系统和偏工作流密度的产品体验。

## 中文要求

- 新增产品文档、页面说明、注释和交付说明优先中文。
- 代码标识符、API 字段、第三方库名保持原文。

## 验证

- 后端：`cd neptune-ai/server && bun test`。
- 前端开发服务：`cd neptune-ai/web && bun run dev`。
- E2E：从 `neptune-ai/web` 执行 `npx playwright test --config=../../.agents/skills/e2e-testing/playwright.config.ts`，除非技能指定更窄命令。
