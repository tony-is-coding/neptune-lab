# V10 用户需求

## 版本: v10
## 确认时间: 2026-04-27

---

## 优化目标

V10 是里程碑版本，完成 claude-code/ 与 claude-code-cli/ 的物理分离，使 SDK 核心可独立运行。同时完善启动提取、解耦 React 依赖、补充架构文档。

## 工作范围

### 1. V10 物理分离切割（路线图核心里程碑）
- `claude-code/` 目录只保留 SDK 核心
- CLI/TUI 物理分离到 `claude-code-cli/`
- migrations/、commands/、screens/、components/、keybindings/、vim/ 等移到 claude-code-cli/
- main.tsx 移到 claude-code-cli/
- cli/ 目录归属决策：headless 相关留在 SDK，传输层移到 CLI
- claude-code-cli/ 通过 import 引用 claude-code/ 的 SDK API
- 两套 CI：SDK 独立验证 + CLI 端到端验证

### 2. initializeEngine 完善提取（V9 遗留）
- V9 骨架版继续填充
- 设置加载（~160 行）
- 权限初始化（~490 行）
- MCP 配置（~680 行）
- AppState 构建（~210 行）
- 目标：initializeEngine() 可完整独立启动

### 3. AppState React 解耦
- AppState.tsx 是框架内最大的 React 文件（Context Provider）
- 评估 Provider 包装移到 CLI 层的可行性
- 框架侧保留纯数据接口
- 为物理分离扫清最大 React 阻塞项

### 4. 架构文档全面补充
- architecture-design.md 中只有 AgentEngine 的模块说明
- 需要全面采集 claude-code/ 下目标架构
- 每个模块必须要有清晰的说明
- 每个目录都必须记录，方便持续维护
- 项目目标文档补充完整的客户端/服务端/SDK 三层架构图

## 关注范围
- src/（框架核心）
- claude-code-cli/src/（CLI 宿主）
- docs/（文档更新）

## 特殊约束
- V10 完成后 claude-code/ 应可独立运行（零 CLI 依赖已达成，零 React 依赖为目标）
- 遵循"包装不替代"原则
- tsc 零错误、全量测试通过
