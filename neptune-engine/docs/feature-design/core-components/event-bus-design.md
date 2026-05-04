> **文档状态**：✅ 已对齐代码 | 更新时间：2026-04-26
> **实现状态**：M1 基础事件系统已完成，M2-M4 规划中

# Event Bus 设计文档

---

## 一、功能概述

### 1.1 功能目标
Event Bus 是 Agent Engine 的内部事件系统，负责解耦 SDK 使用者和 Engine 层，实现组件间的松耦合通信。

### 1.2 解决的问题
- **组件解耦**：Adapter 和 Engine 不直接依赖，通过事件通信
- **事件驱动**：支持同步事件处理，Hook 管道可拦截事件
- **可扩展性**：新增事件类型和监听器无需修改现有代码
- **可观测性**：统一的事件流，便于监控和调试

### 1.3 适用场景
- SDK 使用者需要监听 Engine 内部事件
- Engine 需要通知外部系统状态变化
- 多个组件需要响应同一事件
- 需要 Session 级别的事件过滤

---

## 二、设计目标

### 2.1 功能性目标
**✅ 已实现**：
- 支持事件发布和订阅（`emit`, `subscribe`, `unsubscribe`）
- 支持 Hook 管道拦截（`hook`）
- 支持 Session 级别的事件过滤

**[规划中]**：
- 支持事件优先级
- 支持事件持久化和回放
- 支持异步事件处理

### 2.2 非功能性目标
- **性能**：事件分发延迟 < 1ms
- **可靠性**：Hook 可阻止事件传播
- **可扩展性**：支持动态注册监听器
- **可观测性**：完整的事件日志和追踪

### 2.3 约束条件
- 仅用于内部组件通信
- 避免事件循环依赖
- Hook 返回 `false` 可阻止事件传播

---

## 三、技术方案

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Event Bus                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  事件发布器 (Publisher)                                │  │
│  │  - emit(type, payload, sessionId?)                    │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ↓                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Hook 管道 (Hook Pipeline) ✅ 已实现                   │  │
│  │  - 事件拦截                                            │  │
│  │  - Hook 返回 false 可取消事件                         │  │
│  │  - 按注册顺序依次执行                                  │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ↓                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  事件持久化 (EventPersistence) [规划中]               │  │
│  │  - 可选，按事件类型过滤持久化                          │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ↓                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  监听器注册表 (Handler Registry) ✅ 已实现             │  │
│  │  Map<string, Listener[]>                              │  │
│  │  - 支持 sessionId 过滤                                 │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ↓                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  事件分发器 (Dispatcher) ✅ 已实现                     │  │
│  │  - 同步顺序分发给所有 handlers                         │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 核心流程

#### 3.2.1 事件发布流程

```
组件调用 emit(type, payload, sessionId?)
    ↓
执行 Hook 管道（按注册顺序）
    ├── Hook 返回 false → 取消事件，流程终止
    └── Hook 返回 true → 继续传播
    ↓
分发给匹配的监听器
    ├── 监听器未指定 sessionId → 接收所有事件
    └── 监听器指定 sessionId → 只接收匹配的事件
```

#### 3.2.2 监听器注册流程

```
组件调用 subscribe(type, handler, options?)
    ↓
添加到监听器注册表
    ↓
可选通过 options.sessionId 过滤特定 Session 的事件
```

#### 3.2.3 事件过滤流程

```
emit(type, payload, sessionId?)
    ↓
获取事件类型对应的所有监听器
    ↓
按 sessionId 过滤
    ├── 监听器未指定 sessionId → 接收
    └── 监听器指定 sessionId → 仅当匹配时接收
    ↓
执行监听器 handler(payload)
```

### 3.3 数据结构

#### 3.3.1 事件类型 ✅ 已实现

```typescript
// 当前实现：使用 string 类型，无预定义枚举
type EventHandler = (payload: unknown) => void

// 监听器配置（支持 Session 过滤）
interface SubscribeOptions {
  sessionId?: string
}

// 内部监听器记录
interface Listener {
  handler: EventHandler
  sessionId?: string
}
```

#### 3.3.2 Hook 函数 ✅ 已实现

```typescript
/**
 * Hook 函数：可拦截事件传播
 * - 返回 true 继续传播
 * - 返回 false 阻止传播
 */
type HookFn = (payload: unknown) => boolean
```

#### 3.3.3 事件类型定义 [规划中]

```typescript
/**
 * 预定义事件类型枚举（未来版本）
 * 当前版本使用 string 类型
 */
export type EngineEventType =
  | 'session:created' | 'session:destroyed' | 'session:paused' | 'session:resumed'
  | 'query:started' | 'query:text' | 'query:tool_use' | 'query:tool_result' | 'query:done' | 'query:error'
  | 'engine:started' | 'engine:stopped'
  | 'tool:pre_execute' | 'tool:post_execute' | 'tool:permission_check'
  | 'checkpoint:saved' | 'checkpoint:restored'
  | 'context:loaded' | 'context:updated'
```

#### 3.3.4 事件持久化 [规划中]

```typescript
/**
 * 事件持久化接口（未实现）
 */
export interface EventPersistence {
  persist(event: unknown): Promise<void>
  loadEvents(sessionId: string, options?: { types?: string[]; limit?: number }): Promise<unknown[]>
}
```

---

## 四、接口设计

### 4.1 核心 API

```typescript
class EventBus {
  // ✅ 订阅事件（支持 Session 级过滤）
  subscribe(type: string, handler: EventHandler, options?: SubscribeOptions): void

  // ✅ 触发事件（同步，经过 Hook 管道）
  emit(type: string, payload: unknown, sessionId?: string): void

  // ✅ 取消订阅
  unsubscribe(type: string, handler: EventHandler): void

  // ✅ 注册 Hook（可拦截事件传播）
  hook(type: string, hookFn: HookFn): void

  // ✅ 清除所有监听器和 Hook
  clear(): void

  // ✅ 将事件序列化为可跨进程传输的 EventBusMessage（V2 新增）
  static toMessage(type: string, payload: unknown, sessionId?: string): EventBusMessage

  // [规划中] 配置事件持久化
  // setPersistence(persistence: EventPersistence, types?: string[]): void

  // [规划中] 查询监听器
  // hasListeners(eventType: string): boolean
  // getListenerCount(eventType: string): number
  // getHookCount(eventType: string): number
}
```

### 4.2 事件类型说明 [规划中]

> **当前实现**：事件类型使用 `string`，无预定义枚举。以下为规划中的事件类型。

**Session 事件**
- `session:created`: Session 创建
- `session:destroyed`: Session 销毁
- `session:paused`: Session 暂停
- `session:resumed`: Session 恢复

**Query 事件**
- `query:started`: 查询开始
- `query:text`: 文本流输出
- `query:tool_use`: 工具调用
- `query:tool_result`: 工具结果
- `query:done`: 查询完成
- `query:error`: 查询错误

**Engine 事件**
- `engine:started`: 引擎启动
- `engine:stopped`: 引擎停止

**Tool 事件（Hook 集成）**
- `tool:pre_execute`: 工具执行前（可通过 Hook 拦截）
- `tool:post_execute`: 工具执行后
- `tool:permission_check`: 工具权限检查

**Checkpoint 事件**
- `checkpoint:saved`: 检查点保存
- `checkpoint:restored`: 检查点恢复

**Context 事件**
- `context:loaded`: 上下文加载完成
- `context:updated`: 上下文更新

### 4.3 使用示例

```typescript
// ✅ 订阅事件（支持 Session 级过滤）
eventBus.subscribe('session:created', (payload) => {
  console.log('Session created:', payload)
})

// ✅ 订阅特定 Session 的事件
eventBus.subscribe('query:text', (payload) => {
  console.log('Text:', payload)
}, { sessionId: 'session-123' })

// ✅ 触发事件（同步）
eventBus.emit('session:created', { sessionId: 'session-123', workspace: '/path/to/workspace' })

// ✅ 触发 Session 级事件
eventBus.emit('query:text', { text: 'hello' }, 'session-123')

// ✅ 注册 Hook（返回 false 阻止传播）
eventBus.hook('tool:pre_execute', (payload) => {
  if (payload.toolName === 'dangerous_tool') {
    return false  // 阻止事件传播
  }
  return true  // 继续传播
})

// ✅ 取消订阅
eventBus.unsubscribe('session:created', handler)

// ✅ 清除所有
eventBus.clear()

// [规划中] 配置事件持久化
// eventBus.setPersistence(myPersistence, ['session:created', 'session:destroyed'])
```

### 4.4 错误处理 [部分已实现]

**✅ 已实现**：Hook 和监听器异常隔离。`emit()` 中每个 handler 和 hook 用 try-catch 包裹，单个处理器抛出异常时不中断事件链，通过 `console.warn` 记录错误。

```typescript
// ✅ 已实现：Hook 异常隔离
for (const hookFn of hookList) {
  try {
    const result = hookFn(payload)
    if (result === false) return  // 阻止传播
  } catch (e) {
    console.warn(`[EventBus] Hook for "${type}" threw error:`, e)
  }
}

// ✅ 已实现：监听器异常隔离
for (const listener of listenerList) {
  try {
    listener.handler(payload)
  } catch (e) {
    console.warn(`[EventBus] Listener for "${type}" threw error:`, e)
  }
}
```

**[规划中]**：
- 全局错误处理器（`eventBus.on('error', ...)`）
- 错误码枚举（`INVALID_EVENT_TYPE` 等）
- 重试机制

---

## 五、实现计划

### 5.1 实现状态

**✅ 已完成（M1：基础事件系统）**：
- EventBus 类骨架
- `emit` / `subscribe` / `unsubscribe`
- 监听器注册表（Map<type, Listener[]>）
- Hook 管道（`hook` 方法）
- Session 级事件过滤
- 基础测试

**[规划中] M2：高级特性**：
- 事件优先级排序
- `once` / `waitFor` 便捷方法
- 查询方法（`hasListeners`, `getListenerCount`）

**[规划中] M3：异步和错误处理**：
- 异步事件分发
- 错误处理和重试机制

**[规划中] M4：持久化和回放**：
- EventPersistence 接口
- 事件持久化存储
- 事件回放和查询

### 5.2 依赖关系

```
EventBus
  ├── ✅ 无外部依赖（M1 已完成）
  └── [规划中] 依赖存储层（M4）
```

### 5.3 里程碑

- **✅ M1**：基础事件系统（emit, subscribe, unsubscribe, hook）- 已完成
- **M2**：高级特性（过滤增强、优先级、waitFor）- 规划中
- **M3**：异步和错误处理 - 规划中
- **M4**：持久化和回放（存储、查询、回放）- 规划中

---

## 六、测试计划

### 6.1 测试策略

- **单元测试**：测试每个方法的基本功能
- **集成测试**：测试与其他组件的集成
- **性能测试**：测试事件分发性能
- **压力测试**：测试大量监听器和事件

### 6.2 测试用例

**✅ 已实现（M1）**
- 发布和接收事件
- 注册和取消监听器
- 多个监听器接收同一事件
- Hook 阻止事件传播
- Session 级事件过滤
- 清除所有监听器

**[规划中] M2：高级特性**
- 事件优先级排序
- once 监听器
- waitFor 超时

**[规划中] M3：异步测试**
- 异步事件分发
- 异步监听器错误处理
- 事件顺序保证

**[规划中] M4：性能测试**
- 1000+ 监听器性能
- 10000+ 事件/秒吞吐量
- 事件分发延迟

### 6.3 验收标准

**M1（已完成）**：
- 基础功能测试通过
- Hook 管道测试通过
- Session 过滤测试通过

**M2-M4（规划中）**：
- 所有单元测试通过
- 所有集成测试通过
- 代码覆盖率 > 80%
- 事件分发延迟 < 1ms
- 支持 1000+ 监听器
- 支持 10000+ 事件/秒
- 无内存泄漏
