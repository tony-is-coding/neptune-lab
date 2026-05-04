# V9 工作总结 — 核心启动提取 + 反向依赖彻底消除

> 版本: v9
> 总结时间: 2026-04-27
> 分支: optimize/v9-core-bootstrap-extraction
> 状态: ✅ 版本闭环完成

---

## 一、版本概述

V9 完成了框架核心启动逻辑提取和反向依赖的彻底消除。通过将 commands.ts 的 67 条 CLI 命令导入迁移到 CLI 侧、context/ 目录完整迁移、UI 组件通过 ComponentRegistry 解耦、以及 initializeEngine() 启动函数的骨架实现，框架→CLI 的反向依赖从 74 条降至 **0 条**（-100%），为 V10 物理分离奠定了坚实基础。

**核心主题**：反向依赖归零 + SDK 可独立启动

---

## 二、变化清单

### 新增

| 文件 | 用途 | 行数 |
|------|------|------|
| `claude-code-cli/src/commandRegistry.ts` | CLI 命令注册中心（67 条命令导入） | 462 |
| `claude-code-cli/src/defaultCommandProvider.ts` | CLI 侧 DefaultCommandProvider 实现 | 313 |
| `claude-code-cli/src/utils/componentRegistryRegistration.ts` | CLI UI 组件注册（5 个组件） | 129 |
| `claude-code-cli/src/context/mailbox.tsx` | mailbox React Provider（从框架迁移） | — |
| `claude-code-cli/src/context/notifications.tsx` | 通知 React Context（从框架迁移） | — |
| `src/engine/bootstrap/initializeEngine.ts` | 框架核心启动函数（骨架版） | 477 |
| `src/engine/bootstrap/index.ts` | bootstrap 模块导出 | — |
| `src/utils/componentRegistry.ts` | ComponentRegistry 注册/获取接口 | 164 |
| `src/utils/notificationManager.ts` | NotificationManager（事件/回调模式） | 60 |
| `src/utils/__tests__/mailbox.test.ts` | mailbox 核心逻辑测试 | — |
| `src/types/commandProvider.ts` | ICommandProvider 接口扩展 | — |

### 修改

| 文件 | 变化说明 |
|------|---------|
| `src/commands.ts` | 从 ~1100 行精简至 ~461 行，67 条命令导入清零，仅保留接口+注入+纯框架函数 |
| `src/services/remoteManagedSettings/securityCheck.tsx` | 通过 ComponentRegistry 获取 UI 组件 |
| `src/utils/processUserInput/processBashCommand.tsx` | 通过 registry 获取 BashModeProgress |
| `src/utils/claudeInChrome/toolRendering.tsx` | 通过 registry 获取 MessageResponse |
| `src/utils/computerUse/wrapper.tsx` | 通过 registry 获取 ComputerUseApproval |
| `src/utils/computerUse/toolRendering.tsx` | 通过 registry 获取 MessageResponse |
| `src/state/AppState.tsx` | mailbox 依赖改为注入机制 |
| `src/services/mcp/useManageMCPConnections.ts` | 改为通过 NotificationManager |
| `claude-code-cli/src/main.tsx` | 更新导入路径 |

### 删除

| 文件/目录 | 说明 |
|----------|------|
| `src/context/` 整个目录 | 9 个 React Context 文件全部迁移到 CLI |

### 修复

- SuggestionItem 导入路径从 CLI 改为框架 types/ 层（shellCompletion.ts + directoryCompletion.ts）

---

## 三、新增特性列表

### 1. initializeEngine() 框架核心启动函数

- **描述**：`engine/bootstrap/initializeEngine.ts` 提供独立的框架启动函数，接收纯数据配置对象 `EngineConfig`
- **使用方式**：
  ```typescript
  import { initializeEngine } from 'claude-code/engine/bootstrap'
  const result = await initializeEngine({
    cwd: '/workspace',
    model: 'claude-sonnet-4-6',
    permissionMode: 'default',
    tools: customTools,
    mcpServers: [{ name: 'my-server', command: 'node server.js' }]
  })
  ```
- **影响范围**：headless 模式、服务端嵌入、自动化脚本
- **当前状态**：骨架版 — 模型解析和工具注册已完整实现，其余模块（设置加载、权限初始化、MCP 配置、AppState 构建）标记为 TODO

### 2. ComponentRegistry UI 组件解耦模式

- **描述**：框架通过 `registerDialogComponent/registerInlineComponent/registerPrimitiveComponent` 三类注册点获取 UI 组件，不再直接导入 CLI 的 React/Ink 组件
- **使用方式**：
  ```typescript
  // CLI 启动时注册
  import { registerDialogComponent } from 'claude-code/utils/componentRegistry'
  registerDialogComponent('ManagedSettingsSecurityDialog', MyDialog)

  // 框架内获取
  const Dialog = getDialogComponent('ManagedSettingsSecurityDialog')
  ```
- **影响范围**：5 个框架文件（securityCheck、processBashCommand、toolRendering×2、computerUse/wrapper）

### 3. NotificationEmitter 事件模式

- **描述**：MCP 连接管理器通过 NotificationEmitter 接口发送通知，不再依赖 React hook
- **使用方式**：框架侧定义 NotificationEmitter 接口（emit + subscribe），CLI 侧注入 React 版实现
- **影响范围**：MCP 连接管理、通知系统

### 4. CLI 命令注册中心

- **描述**：`claude-code-cli/src/commandRegistry.ts` 集中管理全部 67 条 CLI 命令导入和注册
- **影响范围**：CLI 启动、命令系统

---

## 四、用户体验改进

### SDK 使用者（开发者）

- **SDK 可独立启动**：`initializeEngine(config)` 函数使 SDK 在无 CLI 环境下可以启动引擎（headless 模式）
- **框架纯净度提升**：框架→CLI 反向依赖从 74 条降至 0，SDK 包更轻量
- **React 污染大幅减少**：框架内 React Context 文件从 9 个降至 0 个（context/ 目录完全删除）

### CLI 使用者

- **功能零影响**：所有 CLI 功能（命令、通知、mailbox、UI 组件）100% 正常
- **命令系统更清晰**：命令注册集中在 CLI 侧的 commandRegistry.ts

---

## 五、技术改进

### 架构层面

| 改进项 | V8 | V9 | 提升 |
|--------|----|----|------|
| 框架→CLI 反向依赖 | 74 条（8 文件） | 0 条 | **-100%** |
| context/ React 文件 | 9 个 | 0 个 | **-100%** |
| commands.ts CLI 导入 | 67 条 | 0 条 | **-100%** |
| UI 组件直接导入 | 5 个文件 | 0 个文件 | **-100%** |

### 代码质量

| 指标 | V8 | V9 | 状态 |
|------|----|----|------|
| tsc 编译错误 | 0 | 0 | 维持 |
| 测试通过数 | 2622 | 2626 | +4 |
| commands.ts 行数 | ~1100 | ~461 | -58% |
| 反向依赖文件数 | 8 | 0 | -100% |

### 设计模式

- **ICommandProvider 注入模式**：CLI 通过 setCommandProvider() 注入命令实现，框架不持有具体命令
- **ComponentRegistry 注册模式**：3 类注册点（dialog/inline/primitive）解耦 UI 组件依赖
- **NotificationEmitter 事件模式**：回调/订阅模式替代 React hook，MCP 通知系统独立于 UI
- **initializeEngine(config) 配置化启动**：纯数据配置驱动引擎初始化

---

## 六、已知问题和后续计划

### 遗留工作

| 项目 | 说明 | 建议版本 |
|------|------|---------|
| initializeEngine 完整实现 | 当前为骨架版，模型解析+工具注册已实现，剩余：设置加载(~160行)、权限初始化(~490行)、MCP配置(~680行)、AppState构建(~210行) | V10 |
| AppState.tsx React 解耦 | 框架内仍有 React 文件（AppState.tsx、teleport.tsx），但不影响 SDK 核心功能 | V10+ |
| React 残留 | 框架内仍有 React 文件（AppState.tsx、teleport.tsx、各 .tsx 工具文件），但不影响 SDK 核心功能 | V10+ |

### 下一步方向（V10：物理分离切割）

1. **目录物理切割** — `claude-code/` 只保留 SDK 核心，CLI/TUI 物理分离到 `claude-code-cli/`
2. **initializeEngine 完整提取** — 分阶段将 main.tsx 中剩余的核心启动逻辑迁移到 initializeEngine.ts
3. **SDK API 正式化** — 基于 initializeEngine 定义正式的 SDK 公共 API
4. **两套 CI 验证** — SDK 独立验证 + CLI 端到端验证

---

## 七、文档维护记录

### 更新文档

| 文档 | 更新内容 | 状态 |
|------|---------|------|
| `docs/architecture-design.md` | 更新目录树：commands.ts 行数修正、context/ 标注已迁移、engine/bootstrap/ 标注新增 initializeEngine.ts、V9 删除/迁移模块说明 | ✅ 已更新 |
| `docs/okr-roadmap.md` | V9 KR1-KR6 全部标注完成、V9 完成标准达成、更新日期 | ✅ 已更新 |

### 文档一致性检查

| 检查项 | 结果 |
|--------|------|
| commands.ts 行数与实际代码一致 | ✅ 已修正为 461 行 |
| context/ 目录标注为已迁移 | ✅ 已标注 |
| engine/bootstrap/initializeEngine.ts 新增记录 | ✅ 已添加 |
| V9 OKR 状态与实际一致 | ✅ 已确认 |
| 反向依赖数据与实际一致 | ✅ 已确认（0 条） |
