# HookCore 设计文档

> 更新时间：2026-04-26
> 状态：已实现
> 文件：`src/engine/hooks/HookCore.ts`

---

## 一、设计目标

### 1.1 核心问题

Claude Code 原始的 `hooks.ts` 存在以下问题：
- 包含 UI 相关的缓冲机制（pendingEvents）
- 与 `src/components/permissions/hooks.ts` 的 UI 渲染耦合
- 无法在 headless/SDK/server 模式下独立使用

### 1.2 解决方案

创建 `HookCore` 作为零 UI 依赖的 Hook 执行模块：
- **包装不替代**：不物理移动 hooks.ts 的代码，仅包装调用
- **零 React 依赖**：通过动态 require 延迟加载，确保模块本身零依赖
- **向后兼容**：保留原始 hooks.ts 的所有功能
- **统一接口**：提供 headless/SDK/server 模式下的公共 API

---

## 二、架构设计

### 2.1 核心概念

HookCore 采用**包装器模式**，将原始 hooks.ts 的执行能力暴露给框架层：

```
┌─────────────────────────────────────────────────────────────┐
│ HookCore (零 UI 依赖)                                        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 公共 API（headless/SDK/server 可用）                │   │
│  │ - executeNotificationHooks()                        │   │
│  │ - executeConfigChangeHooks()                        │   │
│  │ - executeSessionEndHooks()                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 动态 require（延迟加载，零 React 依赖）              │   │
│  │ loadHooks() → require('../../utils/hooks.js')       │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 原始 hooks.ts（Claude Code 原始实现）                │   │
│  │ - 27 种 Hook 事件                                   │   │
│  │ - UI 缓冲机制（在 UI 模式下启用）                   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 动态加载策略

```typescript
// HookCore 模块本身不直接 import hooks.ts
// 而是通过动态 require 延迟加载

const loadHooks = () => {
  return require('../../utils/hooks.js') as typeof import('../../utils/hooks.js')
}
```

**好处**：
1. HookCore 模块本身零 React 依赖
2. TypeScript 编译时不检查 hooks.ts 的依赖
3. 运行时按需加载，headless 模式下可以 mock

---

## 三、使用方式

### 3.1 创建 HookCore 实例

```typescript
import { createHookCore } from './engine/hooks'

const hookCore = createHookCore({
  sessionId: 'session-1',
  projectRoot: '/path/to/project',
  isNonInteractive: true,
})
```

### 3.2 执行通知 Hook

```typescript
await hookCore.executeNotificationHooks({
  message: '任务完成',
  notificationType: 'info',
})
```

### 3.3 执行配置变更 Hook

```typescript
const results = await hookCore.executeConfigChangeHooks(
  'settings',
  '/path/to/settings.json',
  5000, // timeout in ms
)

console.log('Hook results:', results)
// Output:
// [
//   { succeeded: true, output: '...', command: '...' },
//   { succeeded: false, output: 'Error...' },
// ]
```

### 3.4 执行 Session 结束 Hook

```typescript
await hookCore.executeSessionEndHooks(
  'user_exit',
  { saveHistory: true }
)
```

---

## 四、类型定义

### 4.1 HookContext

```typescript
interface HookContext {
  sessionId: string
  projectRoot: string
  isNonInteractive: boolean
}
```

### 4.2 HookResult

```typescript
interface HookResult {
  succeeded: boolean
  output?: string
  command?: string
}
```

### 4.3 HookExecutor

```typescript
interface HookExecutor {
  executeNotificationHooks(data: {
    message: string
    notificationType: string
  }): Promise<void>

  executeConfigChangeHooks(
    source: string,
    filePath?: string,
    timeoutMs?: number
  ): Promise<HookResult[]>

  executeSessionEndHooks(
    reason: string,
    options?: Record<string, unknown>
  ): Promise<void>
}
```

---

## 五、设计决策

### 5.1 为什么不直接移动 hooks.ts 的代码？

1. **最小改动原则**：物理移动代码风险高，可能破坏现有功能
2. **UI 解耦渐进式**：先通过包装隔离依赖，后续再逐步重构
3. **测试友好**：包装器模式使得测试时可以轻松 mock 原始 hooks

### 5.2 动态 require vs 直接 import

| 方式 | 优点 | 缺点 |
|------|------|------|
| **直接 import** | 类型安全、IDE 支持 | 编译时依赖检查，零 React 依赖无法保证 |
| **动态 require** | 零编译时依赖、运行时灵活 | 失去类型检查、需要手动类型断言 |

**选择动态 require 的原因**：
- HookCore 的目标是零 React 依赖，动态 require 确保编译时不检查 hooks.ts
- 运行时可以通过 mock 模块实现测试隔离

### 5.3 为什么需要 HookContext？

HookContext 提供执行上下文：
- `sessionId`：标识当前 Session，用于日志和错误追踪
- `projectRoot`：项目根目录，用于定位 hook 脚本
- `isNonInteractive`：是否为非交互模式，影响 hook 执行行为

---

## 六、验证标准

### 6.1 零 React 依赖

```bash
# 检查是否有 React 导入
grep -r "from 'react'" src/engine/hooks/
# 应该无输出

# 类型检查
bunx tsc --noEmit
# 必须零错误
```

### 6.2 功能验证

```typescript
// 测试通知 Hook
await hookCore.executeNotificationHooks({
  message: 'Test',
  notificationType: 'info',
})
// 应该不抛出错误

// 测试配置变更 Hook
const results = await hookCore.executeConfigChangeHooks('settings')
console.assert(Array.isArray(results), 'Results should be array')
```

### 6.3 类型安全

```typescript
const executor: HookExecutor = createHookCore({ ... })
// TypeScript 编译必须通过
```

---

## 七、后续优化

### 7.1 缓冲机制解耦

当前 pendingEvents 缓冲仍在原始 hooks.ts 中，未来：
- 将缓冲机制改为通用事件发射器（EventBus）
- UI 层通过订阅核心事件实现渲染
- 核心层完全零 UI 依赖

### 7.2 Hook 类型标准化

当前使用 `any` 类型断言，未来：
- 定义精确的 Hook 参数类型
- 移除 `as any` 类型断言
- 提供完整的类型推导

### 7.3 错误处理增强

当前错误处理依赖原始 hooks.ts，未来：
- 统一错误类型定义
- 提供更详细的错误信息
- 支持错误恢复策略

---

## 八、相关文档

- [架构设计文档](../../../architecture-design.md)
- [分层架构标准](../../../architecture-layering-standard.md)
- [Hook 系统 UI 解耦优化](../../../../auto-upgrade/v3/01-optimizer-research.md#优化-14hook-系统-ui-解耦)
- [HookContext 设计文档](./hook-context-design.md)（待创建）
