# V9 任务计划 — 核心启动提取 + 反向依赖彻底消除

> 版本: v9
> 创建时间: 2026-04-27
> 基于: 01-optimizer-research.md

---

## 一、项目概述

**目标**：消除框架→CLI 全部反向依赖（74 条导入），提取 main.tsx 框架核心启动逻辑，实现 SDK 可独立启动。

**核心交付物**：
1. commands.ts 命令导入迁移到 CLI 侧（消除 92% 反向依赖）
2. engine/bootstrap/initializeEngine() 独立启动函数
3. context/ 目录完整迁移到 CLI（框架 React 残留从 9 → 2）
4. ComponentRegistry UI 组件解耦（5 个文件）
5. 全部反向依赖清零

---

## 二、Agent Team 组成

| 角色 | 数量 | 职责 | 需要的能力 |
|------|------|------|-----------|
| **team-lead** | 1 | 任务协调、进度管理、质量把关 | 全局视野、决策能力 |
| **developer-1** | 1 | commands.ts 迁移 + 启动提取 | 大文件重构、接口设计、ICommandProvider 模式 |
| **developer-2** | 1 | ComponentRegistry + UI 解耦 | 组件注册模式、React/Ink 解耦 |
| **developer-3** | 1 | context/ 迁移链（安全迁移 → React 解耦 → 完整迁移） | React Context 解耦、事件模式、类型提取 |
| **tester** | 1 | 编译验证、测试验证、CLI 功能验证 | tsc、bun test、CLI 端到端 |
| **doc-writer** | 1 | 架构文档更新 | 文档写作、架构理解 |

### 协作方式

- developer-1/2/3 并行开发各自任务链
- tester 在每批任务完成后验证
- team-lead 负责代码审核和任务协调
- doc-writer 在所有代码变更完成后统一更新文档

---

## 三、任务阶段规划

### 阶段 A：热身清理（低风险、零依赖）
**目标**：快速产出成果，消除类型级反向依赖 + 安全迁移 7 个 Context
- T1: SuggestionItem 导入路径修复
- T2: context/ 安全迁移（7 个文件）
**验收**：tsc 零错误、测试通过、类型级反向依赖归零

### 阶段 B：核心解耦（并行推进）
**目标**：消除 92% 反向依赖 + UI 组件解耦
- T3: commands.ts 命令导入迁移
- T4: ComponentRegistry + UI 组件解耦
**验收**：commands.ts 零 CLI 命令导入、框架文件零 CLI UI 组件导入

### 阶段 C：启动提取（最复杂）
**目标**：框架核心启动逻辑独立于 CLI
- T5: main.tsx 完整启动提取
**验收**：initializeEngine() 可独立运行、CLI 回归通过

### 阶段 D：React 解耦链（顺序执行）
**目标**：消除 context/ 迁移的 2 个阻塞项
- T6: mailbox React 解耦
- T7: MCP 通知 React 解耦
- T8: context/ 完整迁移
**验收**：src/context/ 不存在

### 阶段 E：收尾验证
**目标**：质量验证 + 文档更新
- T9: 全面质量验证
- T10: 文档更新
**验收**：全量测试通过、文档同步

---

## 四、任务清单

### T1: SuggestionItem 导入路径修复

| 字段 | 内容 |
|------|------|
| **任务编号** | T1 |
| **任务名称** | SuggestionItem 导入路径修复 |
| **任务目标** | 将 shellCompletion.ts 和 directoryCompletion.ts 的 SuggestionItem 导入改为从框架 types/ 导入 |
| **依赖关系** | 无 |
| **执行人** | developer-3 |
| **所属阶段** | A |

**具体操作**：
1. 修改 `src/utils/bash/shellCompletion.ts`：将 `SuggestionItem` 导入路径改为 `../../types/suggestions.js`
2. 修改 `src/utils/suggestions/directoryCompletion.ts`：将 `SuggestionItem` 导入路径改为 `../../types/suggestions.js`
3. 验证 `types/suggestions.ts` 中 SuggestionItem 类型定义完整

**验收标准**：
- [ ] shellCompletion.ts 零 CLI 导入
- [ ] directoryCompletion.ts 零 CLI 导入
- [ ] `bunx tsc --noEmit` 零错误
- [ ] `bun test` 全部通过

---

### T2: context/ 安全迁移（7 个文件）

| 字段 | 内容 |
|------|------|
| **任务编号** | T2 |
| **任务名称** | context/ 安全迁移 |
| **任务目标** | 将 7 个仅被 CLI 引用的 React Context 迁移到 claude-code-cli/src/context/ |
| **依赖关系** | 无 |
| **执行人** | developer-3 |
| **所属阶段** | A |

**具体操作**：
1. 将以下文件从 `src/context/` 迁移到 `claude-code-cli/src/context/`：
   - overlayContext.tsx
   - modalContext.tsx
   - promptOverlayContext.tsx
   - stats.tsx
   - voice.tsx
   - QueuedMessageContext.tsx
   - fpsMetrics.tsx
2. 更新 claude-code-cli/src/ 中对这些文件的导入路径
3. 处理内部依赖（如 overlayContext 导入 AppState）— 迁移后这些变为 CLI→框架的正向依赖
4. 检查迁移后的导入路径正确性

**验收标准**：
- [ ] 7 个文件已在 claude-code-cli/src/context/ 中
- [ ] src/context/ 仅剩 mailbox.tsx 和 notifications.tsx
- [ ] CLI 功能正常（上下文覆盖、模态框、统计、语音、帧率等）
- [ ] `bunx tsc --noEmit` 零错误
- [ ] `bun test` 全部通过

---

### T3: commands.ts 命令导入迁移

| 字段 | 内容 |
|------|------|
| **任务编号** | T3 |
| **任务名称** | commands.ts 命令导入迁移 |
| **任务目标** | 将 67 条 CLI 命令导入从框架 commands.ts 迁移到 CLI 侧，框架只保留接口和注入机制 |
| **依赖关系** | 无（建议优先启动，工作量最大） |
| **执行人** | developer-1 |
| **所属阶段** | B |

**具体操作**：
1. **在 CLI 侧创建 commandRegistry.ts**：
   - 将 COMMANDS() 数组构建逻辑整体搬入
   - 包含全部 67 条命令导入、条件 feature-flag 加载
   - 包含 INTERNAL_ONLY_COMMANDS、REMOTE_SAFE_COMMANDS、BRIDGE_SAFE_COMMANDS 集合
   - 包含 loadAllCommands、builtInCommandNames 等函数

2. **迁移 DefaultCommandProvider 到 CLI 侧**：
   - 类定义移至 claude-code-cli/src/
   - 直接引用 commandRegistry.ts
   - skill/plugin 加载逻辑通过 Provider 接口回调获取（避免循环依赖）

3. **精简框架 commands.ts**：
   - 保留：ICommandProvider 接口、setCommandProvider/getCommandProvider
   - 保留：Command 类型 re-export
   - 保留：getSkillToolCommands/getSlashCommandToolSkills/getMcpSkillCommands（改为调用 Provider）
   - 保留：loadAllCommands（纯框架 skill/plugin 加载逻辑）
   - 删除：全部 67 条 CLI 命令导入、COMMANDS() 数组、DefaultCommandProvider 类

4. **更新 CLI 注入点**：
   - 在 CLI 启动时创建 CLI 侧 DefaultCommandProvider 实例
   - 调用 setCommandProvider() 注入

5. **验证引用点**：
   - 确认框架侧 builtInCommandNames/clearCommandsCache 等通过 Provider 代理
   - 确认 COMMANDS() 消费端改为调用 Provider

**验收标准**：
- [ ] 框架 commands.ts 零 CLI 命令导入（从 67 条降至 0）
- [ ] 框架 commands.ts 保留：接口 + 注入 + 类型 re-export + 纯框架函数
- [ ] CLI 侧 commandRegistry.ts 包含全部命令注册逻辑
- [ ] DefaultCommandProvider 在 CLI 侧实现
- [ ] `bunx tsc --noEmit` 零错误
- [ ] CLI `--help`/`--version` 正常
- [ ] `bun test` 全部通过

---

### T4: ComponentRegistry + UI 组件解耦

| 字段 | 内容 |
|------|------|
| **任务编号** | T4 |
| **任务名称** | ComponentRegistry + UI 组件解耦 |
| **任务目标** | 设计 ComponentRegistry，5 个框架文件通过注册模式获取 UI 组件 |
| **依赖关系** | 无 |
| **执行人** | developer-2 |
| **所属阶段** | B |

**具体操作**：
1. **设计 ComponentRegistry**（扩展 utils/swarm/componentRegistry.ts 或新建）：
   - `registerDialogComponent(name, Component)` — 覆盖 ManagedSettingsSecurityDialog、ComputerUseApproval
   - `registerInlineComponent(name, Component)` — 覆盖 BashModeProgress
   - `registerPrimitiveComponent(name, Component)` — 覆盖 MessageResponse
   - 每个注册点提供 `getComponent(name)` 获取方法

2. **修改 5 个框架文件**：
   - `services/remoteManagedSettings/securityCheck.tsx` — 通过 registry 获取 ManagedSettingsSecurityDialog + KeybindingSetup
   - `utils/processUserInput/processBashCommand.tsx` — 通过 registry 获取 BashModeProgress
   - `utils/claudeInChrome/toolRendering.tsx` — 通过 registry 获取 MessageResponse
   - `utils/computerUse/wrapper.tsx` — 通过 registry 获取 ComputerUseApproval
   - `utils/computerUse/toolRendering.tsx` — 通过 registry 获取 MessageResponse

3. **CLI 启动时注册组件**：
   - 在 CLI 启动路径中调用注册函数，注入 Ink 组件实现

4. **处理 securityCheck.tsx 的独立渲染生命周期**：
   - 此文件通过 `ink.render()` 挂载完整 Ink 树
   - 需要特殊处理：registry 提供的是组件工厂而非直接组件

**验收标准**：
- [ ] ComponentRegistry 提供注册/获取接口
- [ ] 5 个框架文件零 CLI UI 组件直接导入
- [ ] CLI 启动时注册全部 UI 组件
- [ ] BashMode、ComputerUse、Chrome 模式 UI 正常渲染
- [ ] `bunx tsc --noEmit` 零错误
- [ ] `bun test` 全部通过

---

### T5: main.tsx 完整启动提取

| 字段 | 内容 |
|------|------|
| **任务编号** | T5 |
| **任务名称** | main.tsx 完整启动提取 |
| **任务目标** | 从 main.tsx 提取 ~1,685 行框架核心启动逻辑到 engine/bootstrap/，提供 initializeEngine() 独立函数 |
| **依赖关系** | 建议 T3 完成后启动（commands.ts 已迁移，启动提取更干净） |
| **执行人** | developer-1 |
| **所属阶段** | C |

**具体操作**：
1. **设计 initializeEngine(config) 接口**：
   ```typescript
   interface EngineInitConfig {
     workspace: string
     systemPrompt?: string
     model?: string
     permissionMode?: string
     tools?: ToolExtension[]
     extensions?: ExtensionConfig
     mcpServers?: MCPServerConfig[]
     settings?: Partial<Settings>
   }
   ```

2. **提取设置加载（~160 行）**：
   - 从 main.tsx L714-807, L1280-1349 提取
   - 将 `loadSettingsFromFlag`、`eagerLoadSettings` 改为接收 config 对象
   - 去除对 Commander options 的依赖

3. **提取权限初始化（~490 行）**：
   - 从 main.tsx L2252-2737 提取
   - 将 `initialPermissionModeFromCLI`、`initializeToolPermissionContext` 改为接收 config
   - 去除对 `options` 对象的依赖

4. **提取工具注册（~40 行）**：
   - 从 main.tsx L2874-2912 提取
   - `getTools(toolPermissionContext)` 调用

5. **提取 MCP 配置（~680 行）**：
   - 从 main.tsx L2280-2519, L2747-2797, L3584-4172 提取
   - MCP server 配置解析、policy 过滤、连接建立

6. **提取 AppState 构建（~210 行）**：
   - 从 main.tsx L3880-3907, L4291-4411 提取
   - `getDefaultAppState()` + 字段赋值

7. **提取 Store 创建（~5 行）**：
   - `createStore(initialState, onChangeAppState)`

8. **提取模型解析（~40 行）**：
   - `parseUserSpecifiedModel`、`ensureModelStringsInitialized`

9. **创建 engine/bootstrap/initializeEngine.ts**：
   - 组装以上逻辑为 `initializeEngine(config)` 函数
   - 返回 `{ store, tools, toolPermissionContext, appState }`

10. **修改 main.tsx**：
    - .action() 处理器改为调用 initializeEngine(config) + CLI 编排
    - config 从 Commander options 构建
    - 保留 CLI 编排逻辑（Ink 渲染、REPL 启动等）

**验收标准**：
- [ ] engine/bootstrap/initializeEngine.ts 存在，提供 initializeEngine(config) 函数
- [ ] initializeEngine(config) 接收纯数据 config 对象，零 CLI 依赖
- [ ] headless 模式可通过 initializeEngine() 直接启动
- [ ] main.tsx 的 .action() 处理器调用 initializeEngine() + CLI 编排
- [ ] CLI 启动流程 100% 兼容（--help、--version、交互模式、headless 模式）
- [ ] `bunx tsc --noEmit` 零错误
- [ ] `bun test` 全部通过

---

### T6: mailbox React 解耦

| 字段 | 内容 |
|------|------|
| **任务编号** | T6 |
| **任务名称** | mailbox React 解耦 |
| **任务目标** | 将 mailbox.tsx 的核心逻辑提取为纯 JS 实现，React Provider 仅在 CLI 层 |
| **依赖关系** | 无 |
| **执行人** | developer-3 |
| **所属阶段** | D |

**具体操作**：
1. 分析 `src/context/mailbox.tsx` 的核心逻辑：
   - 消息队列管理
   - 事件处理
   - 状态管理
2. 提取核心逻辑到 `src/utils/mailboxCore.ts`（零 React）
3. mailbox.tsx 改为从 mailboxCore.ts 导入核心逻辑，仅保留 React Provider 包装
4. AppState.tsx 的 MailboxProvider 引用改为通过注入机制获取（而非直接 import）
5. 评估 mailbox 是否可通过 bootstrap/state.ts 管理

**验收标准**：
- [ ] utils/mailboxCore.ts 零 React 依赖
- [ ] mailbox.tsx 仅保留 React Provider 包装
- [ ] AppState.tsx 的 mailbox 依赖已解耦
- [ ] `bunx tsc --noEmit` 零错误

---

### T7: MCP 通知 React 解耦

| 字段 | 内容 |
|------|------|
| **任务编号** | T7 |
| **任务名称** | MCP 通知 React 解耦 |
| **任务目标** | MCPConnectionManager 不再通过 React hook 发送通知，改为事件/回调模式 |
| **依赖关系** | 无（依赖 V8 T7 Notification 类型已提取） |
| **执行人** | developer-3 |
| **所属阶段** | D |

**具体操作**：
1. 在 `types/notification.ts` 中定义 NotificationEmitter 接口：
   ```typescript
   export interface NotificationEmitter {
     emit(notification: CoreNotification): void
     subscribe(handler: (notification: CoreNotification) => void): () => void
   }
   ```
2. 修改 MCPConnectionManager：将 `useNotifications` 调用改为通过 NotificationEmitter
3. 在 bootstrap/state.ts 中注册 NotificationEmitter 实例
4. CLI 层的 notifications.tsx 创建 React 版 Emitter，注入到框架

**验收标准**：
- [ ] MCPConnectionManager 零 React hook 调用
- [ ] NotificationEmitter 接口定义在 types/ 中
- [ ] CLI 层注入 React 版 Emitter
- [ ] MCP 连接管理功能正常
- [ ] `bunx tsc --noEmit` 零错误

---

### T8: context/ 完整迁移

| 字段 | 内容 |
|------|------|
| **任务编号** | T8 |
| **任务名称** | context/ 完整迁移 |
| **任务目标** | 将 mailbox.tsx 和 notifications.tsx 迁移到 CLI，删除 src/context/ 目录 |
| **依赖关系** | T6 + T7 |
| **执行人** | developer-3 |
| **所属阶段** | D |

**具体操作**：
1. 将 mailbox.tsx 迁移到 claude-code-cli/src/context/（核心逻辑已在 utils/mailboxCore.ts）
2. 将 notifications.tsx 迁移到 claude-code-cli/src/context/（MCP 已改为 NotificationEmitter）
3. 更新 CLI 内所有导入路径
4. 删除 src/context/ 目录
5. 清理框架内对 context/ 的所有引用

**验收标准**：
- [ ] src/context/ 目录不存在
- [ ] 框架零 React Context 文件（仅剩 AppState.tsx + teleport.tsx）
- [ ] CLI 通知功能正常
- [ ] CLI mailbox 功能正常
- [ ] `bunx tsc --noEmit` 零错误
- [ ] `bun test` 全部通过

---

### T9: 全面质量验证

| 字段 | 内容 |
|------|------|
| **任务编号** | T9 |
| **任务名称** | 全面质量验证 |
| **任务目标** | V9 质量门槛：tsc + 测试 + CLI 功能 + 反向依赖清零 |
| **依赖关系** | T1-T8 全部完成 |
| **执行人** | tester |
| **所属阶段** | E |

**具体操作**：
1. `bunx tsc --noEmit` — 零错误
2. `bun test` — 全量测试通过
3. `bun run lint:layers` — 零违规
4. CLI `--help`/`--version` — 正常
5. CLI 交互模式 — 正常
6. headless 模式 — 通过 initializeEngine() 启动成功
7. 反向依赖最终统计：确认框架→CLI 反向依赖归零
8. React 残留统计：确认框架内 React 文件数

**验收标准**：
- [ ] tsc 零错误
- [ ] bun test 全部通过
- [ ] lint:layers 零违规
- [ ] CLI 功能 100% 正常
- [ ] headless 模式可独立启动
- [ ] 框架→CLI 反向依赖：0 条
- [ ] React 残留文件：≤ 2（AppState.tsx + teleport.tsx）

---

### T10: 文档更新

| 字段 | 内容 |
|------|------|
| **任务编号** | T10 |
| **任务名称** | 文档更新 |
| **任务目标** | 更新架构文档反映 V9 变化 |
| **依赖关系** | T1-T9 |
| **执行人** | doc-writer |
| **所属阶段** | E |

**具体操作**：
1. 更新 `docs/architecture-design.md`：
   - 目录树反映 context/ 删除、commands.ts 精简、engine/bootstrap/initializeEngine.ts 新增
   - 更新模块依赖关系图
2. 更新 `docs/okr-roadmap.md`：
   - V9 KR 完成状态
   - 更新 V10 前置条件达成情况
3. 更新 `CLAUDE.md`（如需要）：
   - 反映 commands.ts 变化

**验收标准**：
- [ ] architecture-design.md 目录树与实际代码一致
- [ ] okr-roadmap.md V9 状态标注完成
- [ ] 文档中无过时信息

---

## 五、任务依赖关系图

```
阶段 A（热身）
  T1 (SuggestionItem 修复) ──── 无依赖
  T2 (context/ 安全迁移)   ──── 无依赖

阶段 B（核心解耦，2 个可并行）
  T3 (commands.ts 迁移)    ──── 无依赖，工作量最大
  T4 (ComponentRegistry)   ──── 无依赖，可与 T3 并行

阶段 C（启动提取）
  T5 (完整启动提取)        ──── 建议 T3 完成后

阶段 D（React 解耦链，顺序执行）
  T6 (mailbox 解耦)        ──── 无依赖
  T7 (MCP 通知解耦)        ──── 无依赖
  T8 (context/ 完整迁移)   ──── 依赖 T2 + T6 + T7

阶段 E（收尾）
  T9 (质量验证)            ──── 依赖 T1-T8
  T10 (文档更新)           ──── 依赖 T9
```

---

## 六、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| T3 commands.ts 循环依赖 | DefaultCommandProvider 需引用框架 skill 系统 | skill/plugin 加载留在框架侧，Provider 通过接口回调 |
| T5 main.tsx 提取复杂度 | 3,780 行巨型 action handler 需逐块解耦 | 分块提取、每块验证、保留回退方案 |
| T4 securityCheck 独立渲染 | Ink render 生命周期需特殊处理 | registry 提供组件工厂而非直接组件 |
| T6/T7 React 解耦影响 MCP/通知 | MCP 连接管理核心功能 | 先提取接口、再替换实现、双路验证 |
| T8 context/ 迁移遗漏依赖 | 迁移后编译失败 | 前置审计 + T6/T7 先解耦阻塞项 |
