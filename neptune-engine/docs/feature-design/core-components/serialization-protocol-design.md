# 序列化协议设计文档

**版本**：v1
**创建时间**：2026-04-26
**状态**：已实现（基础协议）

---

## 1. 概述

本文档定义 Agent Engine 框架的跨进程序列化协议。目标是支持 Session 状态在进程间传输，为分布式部署、崩溃恢复、水平扩展提供基础。

### 设计原则

1. **最小序列化面**：只序列化 engine/ 实际使用的核心字段（[ENGINE] 分组）
2. **版本化协议**：所有快照类型包含 `version` 字段，支持向前兼容
3. **JSON 原生**：所有序列化格式必须是 `JSON.stringify/parse` 可处理的，不依赖自定义序列化器
4. **CC 字段剥离**：CC 原始代码的内部字段（[CC_COMPAT] + [CC_INTERNAL]）不纳入序列化，由 CC 运行时自行恢复

---

## 2. 数据类型序列化格式

### 2.1 Session（会话实体）

**已有机制**：`Session.toSnapshot()` / `Session.restore()` — 已验证可用于往返传输。

```typescript
interface SessionSnapshot {
  sessionId: string        // UUID
  workspace: string        // 工作目录路径
  createdAt: number        // 创建时间戳（毫秒）
  status: SessionStatus    // 'active' | 'paused' | 'destroyed'
  metadata: Record<string, unknown>  // 用户自定义元数据
}
```

**传输约束**：
- 所有字段都是 JSON 原生类型
- metadata 的 value 必须是 JSON 可序列化的（使用方负责保证）
- 往返一致性：`Session.restore(snapshot).toSnapshot()` 深度等于原 snapshot

### 2.2 SessionContext（会话上下文）

**新增机制**：`sessionContextToSnapshot()` / `restoreSessionContextFromSnapshot()`

```typescript
interface SessionContextSnapshot {
  version: number          // 协议版本号（当前 = 1）
  sessionId: string        // 会话 ID
  cwd: string              // 当前工作目录
  projectRoot: string      // 项目根目录
  memoryPath?: string      // 用户记忆路径（可选）
}
```

**序列化范围**：

| 字段 | 是否序列化 | 说明 |
|------|-----------|------|
| sessionId | ✅ | 核心标识 |
| cwd | ✅ | 工作目录 |
| projectRoot | ✅ | 项目根 |
| memoryPath | ✅ | 记忆路径 |
| originalCwd | ❌ | 可从 cwd 恢复 |
| modelUsage | ❌ | 运行时累积数据，不序列化 |
| isInteractive | ❌ | 启动时决定，不需要持久化 |
| isRemoteMode | ❌ | 启动时决定 |
| sessionPersistenceDisabled | ❌ | 启动配置 |
| parentSessionId | ❌ | CC 兼容字段 |
| 其他 CC_INTERNAL 字段 | ❌ | CC 运行时自行恢复 |

### 2.3 EventBus 事件消息

**新增机制**：`EventBus.toMessage()` 静态方法

```typescript
interface EventBusMessage {
  version: number          // 协议版本号（当前 = 1）
  type: string             // 事件类型（如 "session:created", "text"）
  payload: unknown         // 事件负载（JSON 可序列化）
  sessionId?: string       // 关联 Session（可选）
  timestamp: number        // 事件时间戳（毫秒）
}
```

**已知事件类型**：

| 事件类型 | payload 类型 | sessionId | 说明 |
|----------|-------------|-----------|------|
| `session:created` | `{ sessionId, workspace }` | ✅ | Session 创建 |
| `session:paused` | `{ sessionId, workspace }` | ✅ | Session 暂停 |
| `session:resumed` | `{ sessionId, workspace }` | ✅ | Session 恢复 |
| `session:destroyed` | `{ sessionId, workspace }` | ✅ | Session 销毁 |
| `engine:stopped` | `{ reason? }` | ❌ | 引擎停止 |
| `text` | SDK 消息 | ✅ | query() 文本输出 |
| `tool_use` | SDK 消息 | ✅ | query() 工具调用 |
| `tool_result` | SDK 消息 | ✅ | query() 工具结果 |

### 2.4 EngineSnapshot（完整引擎快照）

**新增机制**：`Session.toEngineSnapshot(contextSnapshot)` — 组合 Session + SessionContext 的完整快照。

```typescript
interface EngineSnapshot {
  version: number                  // 协议版本号
  session: SessionSnapshot         // Session 状态
  context: SessionContextSnapshot  // SessionContext 核心字段
}
```

---

## 3. 序列化协议版本

当前协议版本：**1**

版本演进规则：
- **主版本变更**（破坏兼容）：新增必填字段、删除字段、改变字段语义
- **次版本不变**：新增可选字段、新增事件类型

版本检查位置：
- 反序列化时检查 `snapshot.version`，不匹配则抛出 `SERIALIZATION_VERSION_MISMATCH` 错误
- 当前不做跨版本兼容，版本不匹配直接拒绝

---

## 4. 跨进程传输流程

### 4.1 Session 迁移（进程 A → 进程 B）

```
进程 A:
1. sessionCtx = getSessionContext(sessionId)
2. ctxSnapshot = sessionContextToSnapshot(sessionCtx)
3. engineSnapshot = session.toEngineSnapshot(ctxSnapshot)
4. JSON.stringify(engineSnapshot) → 传输通道

进程 B:
1. snapshot = JSON.parse(received)
2. session = Session.restore(snapshot.session)
3. ctx = restoreSessionContextFromSnapshot(snapshot.context)
4. 将 session 和 ctx 注册到 AgentEngine
5. 恢复后可继续调用 query()
```

### 4.2 EventBus 消息转发

```
进程 A (EventBus emit):
1. message = EventBus.toMessage(type, payload, sessionId)
2. JSON.stringify(message) → 消息通道（IPC/Redis/WebSocket）

进程 B (EventBus receive):
1. message = JSON.parse(received)
2. 验证 message.version === SERIALIZATION_PROTOCOL_VERSION
3. eventBus.emit(message.type, message.payload, message.sessionId)
```

---

## 5. 未覆盖的场景

以下场景需要后续 Phase 实现：

1. **TokenBudgetState 序列化**：当前 `TokenBudgetManager` 使用模块级 Map，需要改为 per-session 管理
2. **QueryEngine 状态序列化**：QueryEngine 的对话历史（messages）目前通过 JSONL transcript 文件持久化，不纳入此协议
3. **传输通道抽象**：IPC / Redis / WebSocket 等传输层未在此协议中定义，由使用方实现
4. **增量同步**：当前只支持全量快照，增量状态同步需要后续设计

---

## 6. 测试覆盖

- `session.test.ts`：Session toSnapshot/restore 往返测试 ✅
- `SessionContextSnapshot` 往返测试：验证序列化后反序列化能恢复核心字段
- `EventBusMessage` 格式测试：验证 toMessage 输出格式正确
