# Neptune Engine 规则

## 范围

- 本包负责 Agent Engine SDK：agent 生命周期、工具执行、对话/session 管理、SDK 导出、MCP client 行为和多模型支持。
- 本包不能依赖 Neptune AI 的产品 UI、计费、用户管理或产品特定业务逻辑。

## 架构

- 大范围 engine 改动前读取 `CONTEXT.md`。
- 改动核心 engine 边界前读取 `docs/architecture.md`。
- 优先使用小接口承载复杂实现的深模块，避免只转发的浅包装。
- 除非任务明确是架构调整，否则保持现有 package/module 边界。
- 通过模块接口测试行为，不测试私有实现细节。

## 中文要求

- 新增设计说明、注释、开发文档优先中文。
- 代码标识符、公开 API、协议字段、错误码保持原文。

## 验证

- 默认测试命令：`bun test`。
- 类型或导出面变更：`bunx tsc --noEmit`。
- 边界/分层变更：编辑前检查现有 lint/layer 脚本。
