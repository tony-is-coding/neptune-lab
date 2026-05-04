# V8 工作总结 — 内部架构收尾

> 版本: v8
> 完成时间: 2026-04-27
> 分支: optimize/v8-internal-cleanup（已 merge 到 main）

---

## 一、版本概述

V8 完成了框架内部的架构收尾工作：实现了 ICommandProvider 命令注入机制，消除了 6 处框架→CLI 反向依赖（含 Gemini 客户端的 5 级跨包依赖），删除了 buddy/ 娱乐模块和 55 个死代码文件。框架核心（engine/）保持零 CLI 依赖，tsc 零错误，2622 测试全量通过。

---

## 二、变化清单

### 新增文件

| 文件 | 用途 |
|------|------|
| `src/utils/sse.ts` | SSE 解析纯函数（parseSSEFrames + SSEFrame），从 CLI 提取 |
| `src/utils/poorModeState.ts` | poorMode 状态管理（isPoorModeActive / setPoorModeActive） |
| `src/types/notification.ts` | CoreNotification 纯数据类型（零 React 依赖） |
| `src/types/bridge.ts` | BridgePermissionCallbacks 类型（从 CLI bridge 提取） |
| `src/utils/sessionIdCompat.ts` | sessionIdCompat 函数（从 CLI bridge 迁移） |
| `src/bootstrap/bridgeConfig.ts` | bridgeEnabled 状态（依赖注入替代 CLI 导入） |
| `src/utils/__tests__/sse.test.ts` | SSE 解析测试（从 CLI 迁移） |

### 修改文件

| 文件 | 变化 |
|------|------|
| `src/commands.ts` | 新增 DefaultCommandProvider 类（14 方法）+ setCommandProvider 真实注入 |
| `src/types/commandProvider.ts` | 接口定义不变，现已有真实实现 |
| `src/context/notifications.tsx` | 从 types/notification.ts 导入纯数据类型，扩展 JSXNotification |
| `src/state/AppStateStore.ts` | 改为从 types/ 导入 CoreNotification 和 BridgePermissionCallbacks |
| `src/services/api/gemini/client.ts` | 消除 `../../../../../claude-code-cli/` 5 级路径依赖 |
| `src/constants/product.ts` | sessionIdCompat 改为从框架内部导入 |
| `src/utils/config.ts` | bridgeEnabled 改为从框架 bootstrap 导入 |
| `src/query/stopHooks.ts` | poorMode 改为从框架 utils 导入 |
| `src/services/SessionMemory/sessionMemory.ts` | poorMode 改为从框架 utils 导入 |
| `src/Tool.ts` | Notification 改为从 types/ 导入 |
| `src/types/toolContext.ts` | Notification 改为从 types/ 导入 |
| `src/services/api/claude.ts` | Notification 改为从 types/ 导入 |

### 删除文件（共 55 个）

| 批次 | 文件/目录 | 数量 | 原因 |
|------|----------|------|------|
| T1 | `claude-code-cli/src/components/tasks/src/` 嵌套 type stub | 28 | V7 迁移残留，零引用 |
| T3 | `src/buddy/` 整个目录 | 7 | 纯 CLI 娱乐功能，feature('BUDDY') 门控 |
| T1 | `claude-code-cli/src/migrations/src/` 嵌套目录 | 1 | 误操作产物 |
| T1 | `src/jobs/classifier.ts` | 1 | 零引用死代码 |
| 补充 | `src/{types,context,bootstrap,constants}/src/` | 27 | V7 迁移残留嵌套 stub |
| 补充 | buddy 外部引用清理（messages.ts, attachments.ts） | 2 处 | 删除 buddy/ 后的引用清理 |

---

## 三、新增特性列表

### 3.1 ICommandProvider 命令注入机制

**描述**：框架通过 ICommandProvider 接口获取命令实现，CLI 在启动时注入具体的 DefaultCommandProvider。

**使用方式**：
```typescript
// CLI 启动时注入
import { setCommandProvider, DefaultCommandProvider } from 'claude-code'
setCommandProvider(new DefaultCommandProvider())

// 框架核心通过接口消费
const provider = getCommandProvider()
const commands = provider?.getCommands()
```

**影响范围**：commands.ts 中 119 条 CLI 命令导入暂保留为过渡方案，ICommandProvider 已实现完整注入链路。未来 V9 可将命令导入迁移到 CLI 侧的 DefaultCommandProvider 中。

### 3.2 CoreNotification 纯数据类型

**描述**：框架核心使用的 Notification 类型从 React 文件中提取，零 React 依赖。

**使用方式**：
```typescript
// 框架核心 — 零 React
import type { CoreNotification } from './types/notification.js'

// CLI 层 — 含 JSX 扩展
import type { Notification } from './context/notifications.js' // TextNotification | JSXNotification
```

**影响范围**：Tool.ts、toolContext.ts、AppStateStore.ts、claude.ts 四个核心文件不再间接依赖 React。

### 3.3 SSE 解析工具

**描述**：parseSSEFrames 纯函数从 CLI 包提取到框架核心，供 Gemini 等多 Provider 复用。

**影响范围**：Gemini 客户端消除最深的跨包依赖（5 级相对路径）。

### 3.4 状态管理提取

**描述**：poorMode 和 bridgeEnabled 状态从 CLI 命令中提取到框架内部管理。

**影响范围**：query/stopHooks.ts 和 SessionMemory 不再动态导入 CLI 命令。

---

## 四、用户体验改进

### 对 SDK 开发者

- **更清晰的依赖边界**：框架→CLI 反向依赖从 19 文件 130 条减少至 14 文件（-26%），框架核心更加独立
- **命令系统可注入**：SDK 用户可通过 ICommandProvider 接口提供自定义命令实现
- **通知类型零 React**：SDK 消费者不需要安装 React 即可使用通知功能
- **SSE 解析可复用**：parseSSEFrames 作为框架工具函数，多 Provider 可直接使用

### 对 CLI 用户

- **无可见变化**：所有 CLI 功能（--help、--version、交互模式）保持正常
- **测试更稳定**：2622 测试全量通过，新增 SSE 解析测试覆盖

---

## 五、技术改进

### 5.1 反向依赖消除

| 消除项 | 文件 | 方式 |
|--------|------|------|
| Gemini SSE 解析 | gemini/client.ts | 纯函数提取到 utils/sse.ts |
| Bridge 权限回调 | AppStateStore.ts | 类型提取到 types/bridge.ts |
| sessionIdCompat | constants/product.ts | 函数迁移到框架 utils/ |
| bridgeEnabled | utils/config.ts | 状态迁移到 bootstrap/bridgeConfig.ts |
| poorMode 状态 | stopHooks.ts + sessionMemory.ts | 状态提取到 utils/poorModeState.ts |
| Notification 类型 | 4 个核心文件 | 类型提取到 types/notification.ts |

### 5.2 代码质量指标

| 指标 | V7 | V8 | 变化 |
|------|----|----|------|
| 反向依赖文件数 | 19 | 14 | -5 (-26%) |
| 死代码文件 | ~55 | 0 | 全部清理 |
| React 残留文件 | 11 | 9 | -2（buddy/ 删除） |
| tsc 错误 | 0 | 0 | 保持 |
| 测试通过 | 2622 | 2622 | 保持 |

### 5.3 架构改进

- **ICommandProvider 注入链路完整**：接口定义 → DefaultCommandProvider 实现 → CLI 启动注入 → QueryEngine 消费
- **核心文件零 React 间接依赖**（通过 Notification 类型提取）
- **Bridge 模块单向依赖**（消除 AppStateStore ↔ CLI bridge 循环）

---

## 六、已知问题和后续计划

### 遗留技术债

1. **commands.ts 119 条 CLI 导入**：ICommandProvider 已实现但命令导入未迁移，属于过渡方案
2. **T8 UI 组件反向依赖**（8 个文件）：需要 ComponentRegistry 新架构，推迟到后续版本
3. **T9 context/ 目录迁移**：2 处 React 运行时依赖（AppState.tsx→mailbox, MCPConnectionManager→notifications），推迟到 V9
4. **React 残留 9 个文件**：context/（6）、state/AppState.tsx（1）、MCPConnectionManager.tsx（1）、其他（1）

### 后续版本方向

1. **V9 核心启动提取** — 利用 ICommandProvider 注入机制进一步解耦命令系统
2. **context/ 整体迁移** — 将 React Context 文件与 AppState.tsx、MCPConnectionManager.tsx 一起迁移到 CLI
3. **ComponentRegistry 设计** — 为 UI 组件反向依赖消除设计新架构
4. **commands.ts 命令导入迁移** — 将 119 条 CLI 命令导入迁移到 CLI 侧

---

## 七、文档维护记录

| 文档 | 操作 | 变更内容 |
|------|------|----------|
| `docs/architecture-design.md` | 更新 | 删除 buddy/ 目录条目，标注 ICommandProvider 已实现，更新测试数量 |
| `docs/okr-roadmap.md` | 更新 | 标注 V8 KR 完成状态，更新 V9 前置条件 |
| `auto-upgrade/v8/00-execution-record.md` | 更新 | 标注 Phase 4 完成 |
| `auto-upgrade/v8/multi-phase-execute-record.md` | 更新 | 记录 Phase 4 完成状态 |
