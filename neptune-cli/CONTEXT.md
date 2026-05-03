# Neptune CLI — 终端 CLI 产品

## 这是什么？

基于 neptune-engine SDK 构建的终端 CLI 宿主，提供炫酷的终端交互体验。

## 为什么存在？

为开发者提供命令行方式使用 Agent 能力的入口，是 neptune-engine SDK 在终端场景下的直接应用。

## 边界

**负责：** 终端 UI 渲染、用户输入处理、命令注册、终端交互体验
**不负责：** Agent 执行逻辑（由 engine SDK 提供）

## 依赖

- 依赖 `neptune-engine/claude-code/`（SDK）
- 可选依赖 `shared/`

## 关键目录

- `src/` — CLI 源码（命令、组件、服务）
- `src/commands/` — 丰富的命令注册
- `src/components/` — 终端 UI 组件（Ink）

## 如何开发

```bash
cd neptune-cli
bun install
bun run dev
```
