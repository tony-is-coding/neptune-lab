# V2 工作总结

**版本号**：v2
**核心主题**：框架深层治理——设计合理性、耦合治理、分布式基础
**执行日期**：2026-04-26
**Commit**：3a6c317

---

## 1. 版本概述

V2 在 V1 基础上对 Agent Engine 框架进行深层治理，覆盖 15 个优化点。核心改动包括：CCRuntime 抽象层将 engine/ 与 CC 原始模块的 7 处硬编码 require() 统一到可注入接口，多 workspace 支持解除了进程级单例限制，分布式序列化协议为跨进程部署奠定了基础。46 个文件变更，+4295/-476 行，129 个测试全部通过。

---

## 2. 变化清单

### 新增

| 类型 | 内容 | 说明 |
|------|------|------|
| 模块 | `engine/cc-runtime/` | CCRuntime 接口 + 默认实现 + Mock 实现，4 个文件 |
| 类型 | `EventBusMessage` | 跨进程事件消息格式（type, payload, sessionId, timestamp, version） |
| 类型 | `SessionContextSnapshot` | SessionContext 核心字段序列化格式（5 个字段） |
| 类型 | `EngineSnapshot` | 完整引擎状态快照（session + context） |
| 类型 | `SERIALIZATION_PROTOCOL_VERSION` | 协议版本号常量（当前 = 1） |
| 方法 | `EventBus.toMessage()` | 静态方法，生成可序列化的事件消息 |
| 方法 | `sessionContextToSnapshot()` | SessionContext → JSON 快照 |
| 方法 | `restoreSessionContextFromSnapshot()` | JSON 快照 → SessionContext |
| 方法 | `Session.toEngineSnapshot()` | Session + Context 完整快照 |
| 事件 | 5 个生命周期事件 | session:created/paused/resumed/destroyed + engine:stopped |
| 错误码 | `SESSION_PAUSED` | 暂停状态调用 query() 时抛出 |
| 错误码 | `SESSION_INVALID_OPERATION` | 对已销毁 Session 的非法操作 |
| 测试 | `integration/` 目录 | 3 个集成测试文件（query/multi-session/load-session） |
| 测试 | CCRuntime.test.ts | CCRuntime 接口测试（15 个） |
| 文档 | serialization-protocol-design.md | 序列化协议设计文档 |

### 修改

| 文件 | 变化 |
|------|------|
| `AgentEngine.ts` | 使用 CCRuntime 访问 CC 模块；query() 双层 AsyncLocalStorage 隔离；生命周期事件 emit；pause 释放 QueryEngine；require('fs') → 静态导入 |
| `OriginalQueryEngineBridge.ts` | runtimeInitialized 从模块级布尔值改为 CCRuntime per-instance；MACRO 版本从硬编码改为 package.json 动态读取 |
| `Session.ts` | 所有 throw 使用 EngineError；新增 toEngineSnapshot() |
| `EventBus.ts` | emit() 中 handler/hook try-catch 隔离；新增 toMessage() 静态方法 |
| `SessionContext.ts` | 字段分三组标注（ENGINE/CC_COMPAT/CC_INTERNAL）；新增序列化/反序列化函数 |
| `types.ts` | 移除死类型（EngineEvent 等 4 个）；新增序列化协议类型 |
| `errors.ts` | 新增 SESSION_PAUSED、SESSION_INVALID_OPERATION 错误码 |
| `ToolAdapter.ts` | 添加职责说明注释 |
| 22 个 CC 文件 | SessionId 空值守卫或非空断言（tsc 修复） |

### 删除

| 内容 | 说明 |
|------|------|
| `EngineEvent`, `TextEvent`, `ResultEvent`, `SystemEvent` | types.ts 中未使用的死类型 |
| 模块级 `runtimeInitialized` 布尔值 | 移至 CCRuntime 实例内部 |
| MACRO 版本号 `'2.1.888'` 硬编码 | 改为动态读取 |

### 修复

| 问题 | 修复方式 |
|------|----------|
| 22 个 tsc 错误 | SessionId \| undefined 类型空值守卫统一修复 |
| Session 测试 instanceof 失败 | EngineError 构造函数添加 Object.setPrototypeOf |
| EventBus 单 handler 异常中断事件链 | try-catch 隔离，console.warn 记录 |
| 暂停 Session query() 无明确错误 | 抛出 EngineError(SESSION_PAUSED) |

---

## 3. 新增特性

### 3.1 CCRuntime 依赖抽象层

**使用方式**：
```typescript
// AgentEngine.create() 接受可选的 ccRuntime 参数
const engine = AgentEngine.create(config, customCCRuntime)

// 默认使用全局单例
const engine = AgentEngine.create(config)

// 测试中使用 MockCCRuntime
const mockRuntime = createMockCCRuntime({
  queryEngineFactory: (config) => mockQueryEngine,
})
const engine = AgentEngine.create(config, mockRuntime)
```

**影响范围**：engine/ 不再直接 require CC 内部模块，所有访问通过 CCRuntime 接口。

### 3.2 多 Workspace 支持

**使用方式**：
```typescript
const engine = AgentEngine.create(config)

// 不同 workspace 的 Session 可以并发创建和 query
const session1 = await engine.createSession({ workspace: '/project-a' })
const session2 = await engine.createSession({ workspace: '/project-b' })

// 并发 query，各自 CWD 隔离
await Promise.all([
  engine.query(session1, '分析项目A'),
  engine.query(session2, '分析项目B'),
])
```

**影响范围**：initializeRuntime() 不再限制为进程级单次调用，per-workspace 初始化 + AsyncLocalStorage 隔离。

### 3.3 生命周期事件

**使用方式**：
```typescript
engine.on('session:created', (payload) => {
  console.log(`Session 创建: ${payload.sessionId}`)
})
engine.on('engine:stopped', () => {
  console.log('引擎已停止')
})
```

**影响范围**：AgentEngine 在 Session 状态变更时自动 emit 事件，使用者可订阅监听。

### 3.4 分布式序列化协议

**使用方式**：
```typescript
// 序列化
const ctxSnapshot = sessionContextToSnapshot(sessionCtx)
const engineSnapshot = session.toEngineSnapshot(ctxSnapshot)
const json = JSON.stringify(engineSnapshot)

// 传输后反序列化
const parsed = JSON.parse(json)
const restoredCtx = restoreSessionContextFromSnapshot(parsed.context)

// EventBus 消息序列化
const message = EventBus.toMessage('session:created', { workspace: '/tmp' }, 'sess-123')
const msgJson = JSON.stringify(message)
```

**影响范围**：为跨进程部署、崩溃恢复、水平扩展提供了序列化基础。

---

## 4. 用户体验改进

| 维度 | V1 状态 | V2 改进 |
|------|---------|---------|
| 多 Workspace | 进程级单例，只能单 workspace | 支持多 workspace 并发，CWD 自动隔离 |
| 错误信息 | Session 内部 throw 原生 Error，调用方需猜测类型 | 统一 EngineError + 错误码，可精确捕获 |
| EventBus 稳定性 | 单个 handler 异常中断整个事件链 | handler/hook 异常隔离，不影响其他处理器 |
| 测试能力 | 无 Mock 机制，测试依赖真实 CC 模块 | CCRuntime Mock 注入，测试完全隔离 |
| 集成测试 | 无 | 3 个集成测试文件覆盖 query/multi-session/load-session |
| 类型安全 | 22 个 tsc 错误 | tsc 0 错误 |

---

## 5. 技术改进

### 架构层面

1. **依赖反转**：engine/ 对 CC 的依赖从直接 require 反转为通过 CCRuntime 接口，遵循依赖倒置原则
2. **状态隔离**：AsyncLocalStorage 双层隔离（CWD + SessionContext），支持多 Session 并发安全
3. **可测试性**：MockCCRuntime 使 engine/ 的单元测试和集成测试不再依赖 CC 原始模块
4. **序列化就绪**：EventBusMessage + SessionContextSnapshot + EngineSnapshot 为分布式部署奠定基础

### 代码质量

1. **死代码清理**：移除 4 个未使用类型
2. **错误类型统一**：Session 内部全部使用 EngineError
3. **导入一致性**：消除 require('fs') 和 require('./SessionContext.js') 的不一致
4. **字段标注**：SessionContext 38 个字段分为 ENGINE/CC_COMPAT/CC_INTERNAL 三组

### 测试覆盖

| 维度 | V1 | V2 |
|------|----|----|
| 框架测试数 | 105 | 129 |
| 集成测试 | 0 个文件 | 3 个文件 |
| CCRuntime 测试 | 0 | 15 个 |
| 序列化测试 | 0 | 10 个 |

---

## 6. 已知问题和后续计划

### 遗留技术债

1. **Bootstrap state 全局单例**：`src/bootstrap/state.ts` 仍是模块级单例，`setupBootstrap()` 会覆盖前值。AsyncLocalStorage 缓解了 `pwd()` 读取，但直接访问 `STATE.cwd` 的代码仍可能读到过期值。
2. **Per-workspace 初始化非线程安全**：`DefaultCCRuntime.workspaceInitialized` 是普通 `Set<string>`，无锁保护。
3. **TokenBudgetState 模块级 Map**：需要改为 per-session 管理才能纳入分布式序列化。
4. **QueryEngine 状态**：对话历史通过 JSONL 持久化，不纳入 EngineSnapshot。跨进程恢复需要重新创建 QueryEngine。
5. **无 workspace 级清理 API**：Session 销毁时不通知 CCRuntime 清理 workspace 级状态。

### V3 方向建议

1. **分布式传输层**：基于序列化协议实现 Redis/WebSocket adapter
2. **TokenBudgetState per-session 化**：从模块级 Map 改为 per-session 管理
3. **Bootstrap state 去全局单例**：将全局状态改为 per-workspace 实例
4. **端到端测试**：真实 QueryEngine 场景的 AgentEngine 测试
5. **并发压力测试**：多 Session 并发场景的性能基线

---

## 7. 文档维护记录

| 操作 | 文档 | 说明 |
|------|------|------|
| 新增 | `docs/feature-design/core-components/serialization-protocol-design.md` | 序列化协议设计文档 |
| 更新 | `docs/architecture-design.md` | 文档索引加入序列化协议；CCRuntime 描述已对齐 |
| 更新 | `docs/feature-design/core-components/event-bus-design.md` | 错误处理从"规划中"改为"部分已实现"；API 加入 toMessage() |
| 更新 | `docs/feature-design/core-components/session-manager-design.md` | V2 Phase 3 已对齐，无需额外更新 |
| 更新 | `docs/feature-design/readme.md` | 目录结构从 3 个文件更新为 11 个文件；更新时间改为 2026-04-26 |
| 无需更新 | `docs/feature-design/core-components/session-design.md` | 与代码一致 |
