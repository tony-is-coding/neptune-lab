# SDK 事件类型清单

本文档列出了 Agent Engine SDK 发出的所有事件类型，供外部订阅者参考。

## 事件命名规范

事件类型使用冒号分隔的层级结构：`<domain>:<action>`

- `domain`: 事件域（如 `session`, `message`, `tool`）
- `action`: 具体动作（如 `created`, `updated`, `completed`）

## 核心事件类型

### Session 生命周期事件

| 事件类型 | 描述 | 负载结构 |
|---------|------|---------|
| `session:created` | 新 Session 创建 | `{ sessionId: string, workspace: string, createdAt: number }` |
| `session:paused` | Session 暂停 | `{ sessionId: string, pausedAt: number }` |
| `session:resumed` | Session 恢复 | `{ sessionId: string, resumedAt: number }` |
| `session:destroyed` | Session 销毁 | `{ sessionId: string, destroyedAt: number }` |
| `session:metadata_updated` | Session metadata 更新 | `{ sessionId: string, key: string, value: unknown }` |
| `session:status_changed` | Session 状态变化 | `{ sessionId: string, oldStatus: string, newStatus: string }` |

### 消息事件

| 事件类型 | 描述 | 负载结构 |
|---------|------|---------|
| `message:started` | 消息处理开始 | `{ sessionId: string, messageId: string, role: string }` |
| `message:completed` | 消息处理完成 | `{ sessionId: string, messageId: string, response: unknown }` |
| `message:error` | 消息处理错误 | `{ sessionId: string, messageId: string, error: string }` |
| `message:stream_chunk` | 流式响应片段 | `{ sessionId: string, messageId: string, chunk: string }` |

### 工具调用事件

| 事件类型 | 描述 | 负载结构 |
|---------|------|---------|
| `tool:called` | 工具被调用 | `{ sessionId: string, toolName: string, args: unknown }` |
| `tool:completed` | 工具调用完成 | `{ sessionId: string, toolName: string, result: unknown }` |
| `tool:error` | 工具调用错误 | `{ sessionId: string, toolName: string, error: string }` |
| `tool:permission_requested` | 工具权限请求 | `{ sessionId: string, toolName: string, args: unknown }` |
| `tool:permission_granted` | 工具权限授予 | `{ sessionId: string, toolName: string }` |
| `tool:permission_denied` | 工具权限拒绝 | `{ sessionId: string, toolName: string, reason?: string }` |

### Agent 事件

| 事件类型 | 描述 | 负载结构 |
|---------|------|---------|
| `agent:created` | Agent 创建 | `{ sessionId: string, agentId: string, name: string }` |
| `agent:started` | Agent 启动 | `{ sessionId: string, agentId: string, taskId: string }` |
| `agent:completed` | Agent 完成 | `{ sessionId: string, agentId: string, taskId: string, result: unknown }` |
| `agent:error` | Agent 错误 | `{ sessionId: string, agentId: string, error: string }` |
| `agent:message` | Agent 消息 | `{ sessionId: string, agentId: string, message: string }` |

### 错误事件

| 事件类型 | 描述 | 负载结构 |
|---------|------|---------|
| `error:occurred` | 一般错误 | `{ sessionId: string, error: string, context?: Record<string, unknown> }` |
| `error:critical` | 严重错误 | `{ sessionId: string, error: string, context?: Record<string, unknown> }` |

### 系统事件

| 事件类型 | 描述 | 负载结构 |
|---------|------|---------|
| `system:ready` | 系统就绪 | `{ timestamp: number, version: string }` |
| `system:shutdown` | 系统关闭 | `{ timestamp: number, reason?: string }` |
| `system:config_updated` | 配置更新 | `{ key: string, oldValue: unknown, newValue: unknown }` |

## 事件消息结构

所有事件都遵循 `EventBusMessage` 结构：

```typescript
interface EventBusMessage {
  version: string           // 序列化协议版本
  type: string              // 事件类型
  payload: unknown          // 事件负载
  sessionId?: string        // 关联的 Session ID（可选）
  timestamp: number         // 事件时间戳
}
```

## 订阅示例

### 订阅所有 Session 事件

```typescript
import { getGlobalEventBridge } from 'src/engine/events'

const bridge = getGlobalEventBridge()

const unsubscribe = bridge.subscribeByType('session:created', (message) => {
  console.log('New session:', message.payload)
})
```

### 订阅特定 Session 的事件

```typescript
const unsubscribe = bridge.subscribeBySession('session-123', (message) => {
  console.log(`Session event: ${message.type}`, message.payload)
})
```

### 过滤订阅

```typescript
const unsubscribe = bridge.subscribe(
  (message) => {
    // 只处理工具调用事件
    if (message.type.startsWith('tool:')) {
      console.log('Tool event:', message)
    }
  },
  { eventType: 'tool:*' }
)
```

## 注意事项

1. **事件顺序**：同一 Session 的事件通常按时间顺序发出，但不保证严格顺序
2. **错误处理**：监听器中的错误不会中断其他监听器的执行
3. **性能考虑**：高频率事件（如 `message:stream_chunk`）需要谨慎处理
4. **内存管理**：使用完毕后务必调用取消订阅函数，避免内存泄漏

## 扩展事件

SDK 允许发出自定义事件，建议使用 `custom:` 前缀：

```typescript
eventBus.emit('custom:my_event', { data: 'value' })
```

## 版本历史

| 版本 | 日期 | 变更说明 |
|------|------|---------|
| 1.0.0 | 2026-04-29 | 初始版本，定义核心事件类型 |
