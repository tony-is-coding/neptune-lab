# V7 用户需求

## 优化目标
研究 CLI 启动相关代码是否可以迁移到独立的 `claude-code-cli` 目录，使框架（Agent Engine）不包含 CLI 特有的逻辑。

## 背景
项目长期目标是将 Claude Code 的核心执行能力从 CLI 宿主中解耦出来，沉淀为通用的 Agent Engine 底座。CLI 启动逻辑不应属于框架内部。

## 关注范围
1. **migrations/** — CLI 启动配置迁移（10+1 个文件，仅被 main.tsx 引用）
   - 1 个死代码：`migrateAutoUpdatesToSettings.ts`
   - 其余 10 个在 `runMigrations()` 中一次性执行
2. **keybindings/** — CLI 终端快捷键系统（16 个文件，被 126+ 文件引用）
   - 大量 re-export `@anthropic/ink`
   - 被 screens、components、commands、hooks 广泛使用
3. **main.tsx 中的其他 CLI 启动逻辑** — Commander.js 命令解析、启动引导
4. **整体 CLI 与框架的分层边界** — 哪些属于「CLI 宿主」，哪些属于「框架核心」

## 核心问题
- 哪些代码属于「CLI 宿主」，哪些属于「框架核心」？
- migrations 是否可以完整迁移出去？
- keybindings 中哪些是框架层需要的（如工具系统中的快捷键提示），哪些是 CLI UI 特有的？
- 是否存在 `claude-code-cli` 目录的迁移可行性？

## 特殊约束
- 最小改动现有代码，优先包裹和外扩
- 核心 agent loop 尽量不变
- 不只关注新增框架引用，必须关注整个 claude-code 核心部分的引用关系
