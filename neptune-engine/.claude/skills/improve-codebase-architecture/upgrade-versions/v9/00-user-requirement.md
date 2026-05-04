# V9 用户需求

## 版本: v9
## 确认时间: 2026-04-27

---

## 优化目标

将框架核心启动逻辑从 CLI 宿主中彻底提取，实现 SDK 可独立启动。同时清除 V8 遗留的反向依赖。

## 工作范围

### 1. 核心启动提取（路线图 V9 KR1-KR5）
- main.tsx 中 ~1000 行框架核心逻辑提取到 engine/bootstrap/
- engine/bootstrap/ 提供 `initializeEngine()` 独立启动函数
- main.tsx 仅保留 CLI 编排逻辑（Commander.js + Ink）
- headless 模式通过 engine/bootstrap/ 直接启动
- CLI 启动流程不受影响

### 2. context/ 目录迁移（V8 T9 推迟）
- 将 React Context 文件（notifications, stats, mailbox, fpsMetrics 等）迁移到 CLI
- 处理 2 处 React 运行时依赖（AppState.tsx→mailbox, MCPConnectionManager→notifications）
- 消除框架中的 6 个 React Context 文件

### 3. UI 组件反向依赖消除（V8 T8 推迟）
- 设计 ComponentRegistry 新架构
- 8 个框架文件不再直接导入 CLI 的 React/Ink 组件
- SuggestionItem 类型提取到 types/ 层

### 4. commands.ts 命令导入迁移
- 将 119 条 CLI 命令导入从 commands.ts 迁移到 CLI 侧
- DefaultCommandProvider 在 CLI 中实现具体命令获取
- 框架 commands.ts 只保留接口和注入机制

## 关注范围
- src/（框架核心）
- claude-code-cli/src/（CLI 宿主）
- engine/ 引擎层

## 特殊约束
- 遵循"包装不替代"原则
- V9 完成后框架核心应能独立于 CLI 启动
- tsc 零错误、全量测试通过
