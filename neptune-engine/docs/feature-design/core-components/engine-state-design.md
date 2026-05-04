# EngineState 设计文档

> 更新时间：2026-04-26
> 状态：已实现
> 文件：`src/engine/EngineState.ts`

---

## 一、设计目标

### 1.1 核心问题

Claude Code 原始的 `AppState` 是一个混合体：
- 包含核心逻辑状态（messages、tools、permissions）
- 同时作为 React Context，被 UI 组件广泛依赖
- 导致核心引擎层间接依赖 React

### 1.2 解决方案

创建 `EngineState` 作为纯核心状态管理器：
- **零 React 依赖**：不依赖任何 UI 类型
- **发布/订阅机制**：通过 EventBus 通知状态变更
- **Facade 模式**：AppState 作为 React Context facade 委托给 EngineState
- **向后兼容**：不改变现有行为，只改变数据存放位置

---

## 二、架构设计

### 2.1 核心字段

EngineState 包含 18 个纯核心字段（从 AppState A 类字段迁移）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `tasks` | `{ [taskId: string]: TaskState }` | 统一任务状态 |
| `agentNameRegistry` | `Map<string, AgentId>` | Agent 名称注册表 |
| `agentDefinitions` | `AgentDefinitionsResult` | Agent 定义列表 |
| `mcp` | `MCPServerState` | MCP 连接和工具 |
| `plugins` | `PluginState` | 插件状态 |
| `fileHistory` | `FileHistoryState` | 文件历史状态 |
| `attribution` | `AttributionState` | 代码归属状态 |
| `todos` | `{ [agentId: string]: TodoList }` | Todo 列表 |
| `toolPermissionContext` | `ToolPermissionContext` | 工具权限上下文 |
| `sessionHooks` | `SessionHooksState` | Session hooks |
| `initialMessage` | `UserMessage \| null` | 初始消息 |
| `pendingPlanVerification` | `PlanVerification \| undefined` | 待验证的计划状态 |
| `activeOverlays` | `ReadonlySet<string>` | 活动覆盖层 |

### 2.2 事件系统

EngineState 提供两种订阅机制：

```typescript
// 方式 1：直接订阅
const unsubscribe = engineState.subscribe((event) => {
  console.log('State changed:', event)
})

// 方式 2：通过 EventBus 订阅
engineState.eventBus.on('engine:tasks:changed', (event) => {
  console.log('Tasks updated:', event.tasks)
})
```

### 2.3 与 AppState 的关系

```
┌─────────────────────────────────────────────────────────────┐
│ AppState (React Context)                                    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ UI 组件依赖的部分（B 类字段）                        │   │
│  │ - userInput                                        │   │
│  │ - selectedTool                                     │   │
│  │ - replMode                                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 核心逻辑部分（A 类字段）                              │   │
│  │                                                      │   │
│  │  ┌──────────────────────────────────────────────┐  │   │
│  │  │ EngineState（零 React 依赖）                   │  │   │
│  │  │ - 实际数据存储                                │  │   │
│  │  │ - 事件发布（EventBus）                        │  │   │
│  │  └──────────────────────────────────────────────┘  │   │
│  │                                                      │   │
│  │  AppState 作为 facade，将 getter/setter 委托给      │   │
│  │  EngineState，保持向后兼容                          │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 三、使用方式

### 3.1 创建实例

```typescript
import { EngineState } from './engine/EngineState'

// 创建空实例
const engineState = new EngineState()

// 从 AppState 数据创建
const engineState = EngineState.fromAppStateData({
  tasks: existingTasks,
  plugins: existingPlugins,
  // ... 其他字段
})
```

### 3.2 读写状态

```typescript
// 读取（只读）
const tasks = engineState.tasks
const plugins = engineState.plugins

// 更新（自动触发事件）
engineState.setTasks(newTasks)
engineState.setPlugins(newPlugins)

// 批量更新
engineState.update((prev) => ({
  ...prev,
  tasks: newTasks,
  plugins: newPlugins,
}))
```

### 3.3 订阅变更

```typescript
// 取消订阅函数
const unsubscribe = engineState.subscribe((event) => {
  switch (event.type) {
    case 'tasks:changed':
      console.log('Tasks updated:', event.tasks)
      break
    case 'mcp:changed':
      console.log('MCP updated:', event.mcp)
      break
    case 'plugins:changed':
      console.log('Plugins updated:', event.plugins)
      break
    // ... 其他事件
  }
})

// 取消订阅
unsubscribe()
```

---

## 四、设计决策

### 4.1 为什么不直接使用 Zustand？

- **目标不同**：EngineState 是框架层的核心状态抽象，需要与 Claude Code 原始 AppState 共存
- **依赖最小化**：EngineState 零外部依赖，Zustand 会引入额外的包依赖
- **类型安全**：EngineState 提供强类型的 getter/setter，比 Zustand 的 API 更明确

### 4.2 为什么要保持 AppState 作为 facade？

- **向后兼容**：现有代码大量使用 `AppState.use()` 或 `AppState.getContext()`
- **渐进迁移**：可以逐步将字段迁移到 EngineState，而不影响现有 UI
- **最小改动**：符合"包装不替代"的框架原则

### 4.3 事件系统的双重设计

EngineState 同时提供：
1. `subscribe(listener)` - 简单订阅 API
2. `eventBus` - 底层 EventBus，支持按事件类型过滤

这样既满足简单使用场景，又支持高级事件路由。

---

## 五、验证标准

### 5.1 零 React 依赖

```bash
# 检查是否有 React 导入
grep -r "from 'react'" src/engine/EngineState.ts
# 应该无输出

# 类型检查
bunx tsc --noEmit
# 必须零错误
```

### 5.2 事件验证

```typescript
// 测试事件触发
let changed = false
engineState.subscribe(() => { changed = true })
engineState.setTasks({})
console.assert(changed === true, 'Event not fired')
```

### 5.3 类型安全

```typescript
// 所有字段必须有正确的类型定义
const state: EngineStateData = engineState.data
// TypeScript 编译必须通过
```

---

## 六、后续优化

### 6.1 字段完整性

当前已迁移 18 个 A 类字段，未来可以考虑：
- 迁移更多核心字段
- 清理 B 类字段的 UI 依赖

### 6.2 性能优化

- 实现字段级别的细粒度订阅（当前是全局订阅）
- 添加状态变更历史记录（用于调试）

### 6.3 分布式支持

- EngineSnapshot 已支持序列化（见 `types.ts`）
- 未来可支持跨进程状态同步

---

## 七、相关文档

- [架构设计文档](../../../architecture-design.md)
- [分层架构标准](../../../architecture-layering-standard.md)
- [AppState 解耦优化](../../../../auto-upgrade/v5/01-optimizer-research.md#优化-6appstate-解耦)
