# V1 工作总结

**版本**：v1
**日期**：2026-04-25 ~ 2026-04-26
**核心主题**：框架核心层架构对齐与代码质量提升

---

## 一、版本概述

V1 是 Agent Engine 框架的首次系统性优化迭代。通过深度分析 33 个引擎源文件（~3073 行），识别 25 个问题，按优先级执行了 10 项优化。核心成果：消除了架构违规（adapters 在框架内、EventBus 死代码）、恢复了 CC 原始权限检查、建立了测试基础设施。

---

## 二、变化清单

### 新增

| 项目 | 说明 |
|------|------|
| `engine/errors.ts` | SessionError 类型，替代裸 Error + 字符串匹配 |
| `engine/session/SessionContextStorage.ts` | AsyncLocalStorage 管理逻辑（从 SessionContext 拆分） |
| `engine/session/TokenBudgetManager.ts` | TokenBudget 管理逻辑（从 SessionContext 拆分） |
| `engine/session/index.ts` | 统一导出 + 向后兼容 re-export |
| PermissionConfig 类型 | 支持通过 bypassPermissions 控制权限行为 |
| `claude-code-framework-test/engine-core/` | 5 个核心模块测试文件 |

### 修改

| 文件 | 变化 |
|------|------|
| `AgentEngine.ts` | EventBus 桥接、全局状态隔离（AsyncLocalStorage）、PermissionConfig |
| `EngineFacade.ts` | 错误处理改为基于 SessionError.code |
| `SessionManager.ts` | throw 改为 SessionError |
| `Session.ts` | 移除 conversationLog 相关 API |
| `EventBus.ts` | 类型优化 |
| `OriginalQueryEngineBridge.ts` | 恢复 CC 原始 canUseTool 权限检查 |
| `SessionContext.ts` | 从 306 行精简到 89 行（拆分+re-export） |
| `TranscriptParser.ts` | 类型优化（QueryEngineMessage） |
| `SQLiteSessionStore.ts` | SessionRow 类型定义 |
| `types.ts` | 清理废弃接口 |

### 删除

| 项目 | 原因 |
|------|------|
| `engine/adapters/HTTPAdapter.ts` | 违反"框架轻量"原则，属于传输层 |
| `engine/adapters/SDKAdapter.ts` | 同上 |
| `engine/adapters/SSEAdapter.ts` | 同上 |
| `engine/observability/ConsoleLogger.ts` | 与 log/ConsoleLogProvider 重复 |
| `engine/observability/ObservabilityContext.ts` | 无外部使用者 |
| Session.conversationLog | 死数据（写入 API 存在但无调用者） |
| SessionManagerConfig 死字段 | 5 个配置字段从未使用 |
| types.ts EngineFacadeConfig | 废弃接口 |

---

## 三、新增特性

### 3.1 事件驱动架构（EventBus 桥接）

**之前**：EventBus 是空壳，query() 只 yield 不 emit，整个事件系统不可用。

**之后**：query() 每条消息同时 yield（拉模式）+ emit（推模式），SDK 使用者可以通过 EventBus 监听消息流。

```typescript
engine.on('message', (msg) => {
  console.log('收到消息:', msg.type)
})
for await (const msg of engine.query(sessionId, 'hello')) {
  // yield 和 emit 收到的是同一条 Message
}
```

### 3.2 权限配置（PermissionConfig）

**之前**：canUseTool 硬编码 allow，跳过 CC 原始权限检查（安全风险）。

**之后**：默认调用 CC 原始权限检查，支持 bypass 配置用于自动化场景。

```typescript
// 默认：使用 CC 原始权限检查
AgentEngine.create({ extensions: { tools: [...] } })

// 自动化场景：绕过权限检查
AgentEngine.create({ extensions: { tools: [...], permissions: { bypassPermissions: true } } })
```

### 3.3 错误码分类（SessionError）

**之前**：错误通过字符串匹配分类（脆弱，上游改文案就失效）。

**之后**：结构化错误码，类型安全。

```typescript
try {
  await engine.createSession(...)
} catch (e) {
  if (e instanceof SessionError) {
    // e.code: 'WORKSPACE_OCCUPIED' | 'MAX_SESSIONS_EXCEEDED' | ...
  }
}
```

---

## 四、用户体验改进

| 维度 | 改进 |
|------|------|
| **SDK 轻量** | 移除 adapters/（350 行死代码），框架只提供 SDK + EventBus |
| **事件可用** | EventBus 从空壳变为可用，支持事件驱动架构 |
| **错误可编程** | SessionError 替代字符串匹配，SDK 使用者可基于错误码处理 |
| **安全性** | 恢复 CC 原始权限检查，不再默认绕过 |
| **记忆隔离** | setMemoryPath 通过 AsyncLocalStorage 传递，不再污染 process.env |

---

## 五、技术改进

| 指标 | 变更前 | 变更后 |
|------|--------|--------|
| engine/ tsc 错误 | 1 | 0 |
| SessionContext.ts 行数 | 306 | 89 |
| any 类型（核心链路） | 30+ 处 | 已为 QueryEngine/EventBus/DB 添加具体类型 |
| 日志系统 | 双系统（observability/ + log/） | 单系统（log/） |
| 测试文件 | 1 个 | 6 个（+5 核心模块测试） |
| 死代码 | conversationLog、空函数、废弃接口 | 已清除 |

---

## 六、已知问题和后续计划

### 已知限制

1. **initializeRuntime() 进程级单例**：仅支持单 workspace 并发，多 workspace 并发需要 CC 侧配合
2. **bootstrap/state 全局状态**：cwd/projectRoot 是进程级单例，多 session 不同 workspace 时会冲突
3. **非 engine/ tsc 错误**：main 分支预存 26 个 tsc 错误（非本次引入）

### 后续优化方向

1. 处理 initializeRuntime() 多 workspace 支持（需要深入 CC bootstrap/state）
2. 补充 AgentEngine 集成测试（需要 mock QueryEngine）
3. 修复非 engine/ 预存 tsc 错误
4. 为测试体系添加 CI 集成

---

## 七、文档维护记录

| 文档 | 操作 | 说明 |
|------|------|------|
| session-store-design.md | 更新 | 移除 SessionSnapshot.conversationLog 字段 |
| feature-design/readme.md | 更新 | 替换 adapter-layer 示例为实际目录结构 |
| session-design.md | 重写 | 反映 Session 纯数据实体设计（agent 更新中） |
| extension-model-design.md | 更新 | 反映当前 AgentEngineConfig 实际结构（agent 更新中） |
