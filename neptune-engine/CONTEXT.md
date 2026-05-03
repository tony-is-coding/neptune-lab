# Neptune Engine — Agent Engine SDK 底座

## 这是什么？

将 Claude Code 的核心 Agent 执行能力解耦为通用 SDK，可嵌入任何应用。

## 为什么存在？

为 Neptune-AI、Neptune-CLI 等产品提供统一的 Agent 执行引擎。不绑定特定的宿主环境（CLI、Web、Desktop），作为所有 AI 产品的技术底座。

## 边界

**负责：** Agent 生命周期管理、工具执行、对话管理、SDK API 导出、MCP 客户端、多模型支持
**不负责：** 产品级 UI 交互、用户管理、计费、特定业务逻辑

## 依赖

- 不依赖任何产品代码
- 被所有产品依赖（作为 SDK）
- 可选依赖 `shared/`

## 关键目录

- `claude-code/` — 核心 SDK 源码（src/、packages/、完整 bun workspace）
- `auto-upgrade/` — 版本升级脚本（v1-v21）
- `docs/` — 设计文档、API 文档
- `research-docs/` — 研究文档

## 如何开发

```bash
cd neptune-engine/claude-code
bun install          # 安装依赖
bun test             # 运行测试（2472 tests / 0 fail）
bun run dev          # 开发模式
bunx tsc --noEmit    # 类型检查
```
