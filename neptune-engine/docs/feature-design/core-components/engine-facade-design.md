> **文档状态**：✅ 最新 | 更新时间：2026-04-25

# EngineFacade 设计文档

---

## 一、功能概述

### 1.1 核心定位

EngineFacade 是 **SessionManager 的业务封装层**，采用 Facade 模式，在 SessionManager 纯数据管理的基础上增加：

- **错误统一转换**：将 SessionManager 内部错误转换为语义明确的 `EngineError`
- **Session 信息投影**：将内部 Session 实体转换为对外暴露的 `SessionInfo`
- **元数据管理**：独立维护一份 Session 元数据映射
- **统计信息**：提供引擎级别的 Session 统计

EngineFacade 不直接涉及 QueryEngine 调用或 EventBus 事件发射（这些由上层 AgentEngine 负责）。

### 1.2 在架构中的位置

```
AgentEngine（统一入口）
  ├── EngineFacade ← 本文档
  │     └── SessionManager
  │           └── Session
  ├── EventBus
  └── Bridge
```

AgentEngine 将 Session 管理操作委托给 EngineFacade，EngineFacade 再委托给 SessionManager。三层各司其职：

| 层级 | 模块 | 职责 |
|------|------|------|
| 统一入口 | AgentEngine | 工厂创建、query 执行、事件监听、生命周期编排 |
| 业务封装 | **EngineFacade** | 错误转换、信息投影、元数据管理、统计 |
| 纯数据层 | SessionManager | Session 注册表、并发限制、CRUD、Store 同步 |

---

## 二、设计目标

### 2.1 功能性目标

- 提供简洁的 Session 生命周期管理 API（创建/查询/暂停/恢复/销毁）
- 将底层错误统一转换为 `EngineError`，携带语义化错误码
- 支持 Session 列表查询与过滤（按 status、workspace）
- 提供引擎级别的 Session 统计信息

### 2.2 非功能性目标

- **易用性**：API 简洁直观，使用者无需了解 SessionManager 内部实现
- **一致性**：所有 Session 操作的错误均以 `EngineError` 抛出，格式统一
- **轻量性**：EngineFacade 本身无副作用，不持有 LLM 连接、不涉及 I/O（metadata 存于内存 Map）

---

## 三、技术方案

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                     AgentEngine                          │
│  createSession() → facade.createSession()               │
│  getSession()    → facade.getSession()                  │
│  listSessions()  → facade.listSessions()                │
│  pauseSession()  → facade.pauseSession()                │
│  resumeSession() → facade.resumeSession()               │
│  destroySession()→ facade.destroySession()              │
│  getStats()      → facade.getStats()                    │
└────────────┬────────────────────────────────────────────┘
             │ 委托
┌────────────┴────────────────────────────────────────────┐
│                   EngineFacade                           │
│                                                          │
│  ┌──────────────────┐  ┌─────────────────────────────┐ │
│  │  错误转换         │  │  信息投影                    │ │
│  │  wrapSessionOp() │  │  toSessionInfo()             │ │
│  └──────────────────┘  └─────────────────────────────┘ │
│                                                          │
│  ┌──────────────────┐  ┌─────────────────────────────┐ │
│  │  元数据管理       │  │  统计信息                    │ │
│  │  sessionMetadata │  │  getStats()                  │ │
│  │  Map             │  │                              │ │
│  └──────────────────┘  └─────────────────────────────┘ │
└────────────┬────────────────────────────────────────────┘
             │ 委托
┌────────────┴────────────────────────────────────────────┐
│                   SessionManager                         │
│  sessions Map、并发限制、workspace 唯一性、ISessionStore │
└─────────────────────────────────────────────────────────┘
```

### 3.2 核心流程

#### 3.2.1 创建 Session

```
AgentEngine.createSession(config)
    │
    ├─ 1. facade.createSession(config)
    │     ├─ manager.createSession(config)
    │     │     ├─ workspace 唯一性检查
    │     │     ├─ 并发限制检查
    │     │     ├─ new Session(config)
    │     │     └─ sessions.set(sessionId, session)
    │     ├─ sessionMetadata.set(sessionId, config.metadata)  // 缓存元数据
    │     └─ return sessionId
    │
    └─ 如果失败 → EngineError(SESSION_WORKSPACE_CONFLICT / SESSION_LIMIT_EXCEEDED / SESSION_CREATE_FAILED)
```

#### 3.2.2 Session 操作（暂停/恢复/销毁）

```
facade.pauseSession(sessionId)  / resumeSession / destroySession
    │
    └─ wrapSessionOperation(sessionId, operation)
          ├─ manager.getSession(sessionId)
          │     └─ 不存在 → throw EngineError(SESSION_NOT_FOUND)
          ├─ session.status === 'destroyed'
          │     └─ 是 → throw EngineError(SESSION_ALREADY_DESTROYED)
          ├─ operation()  // 调用 manager 的对应方法
          │     └─ 异常 → throw EngineError(SESSION_OPERATION_FAILED)
          └─ return
```

#### 3.2.3 查询与统计

```
facade.getSession(sessionId)
    │
    ├─ manager.getSession(sessionId) → Session | undefined
    ├─ 不存在 → return null
    └─ return toSessionInfo(session)
          └─ 组装 id、sessionId、workspace、status、createdAt、metadata

facade.listSessions(filter?)
    │
    ├─ manager.listSessions() → Session[]
    ├─ 按 filter.status 过滤
    ├─ 按 filter.workspace 过滤
    └─ return 映射为 SessionMetadata[]

facade.getStats()
    │
    ├─ manager.listSessions() → Session[]
    └─ return { totalSessions, activeSessions, pausedSessions }
```

---

## 四、接口设计

### 4.1 EngineFacade 类

```typescript
class EngineFacade {
  constructor(config?: EngineConfig)

  // 创建 Session
  async createSession(config: SessionConfig & { sessionId?: string }): Promise<string>

  // 获取 Session 信息，不存在返回 null
  getSession(sessionId: string): SessionInfo | null

  // 列出 Session，支持按 status 和 workspace 过滤
  listSessions(filter?: { status?: SessionStatus; workspace?: string }): SessionMetadata[]

  // 暂停 Session
  async pauseSession(sessionId: string): Promise<void>

  // 恢复 Session
  async resumeSession(sessionId: string): Promise<void>

  // 销毁 Session
  async destroySession(sessionId: string): Promise<void>

  // 获取引擎统计信息
  getStats(): { totalSessions: number; activeSessions: number; pausedSessions: number }
}
```

### 4.2 配置类型

```typescript
// EngineFacade 配置
interface EngineConfig {
  sessionManager?: SessionManagerConfig
}

// SessionManager 配置（透传）
interface SessionManagerConfig {
  maxConcurrentSessions?: number
  maxSessionsPerWorkspace?: number
  sessionTimeout?: number
  autoSaveInterval?: number
  enableCrashRecovery?: boolean
  workspaceRoot?: string
}

// 创建 Session 的配置
interface SessionConfig {
  workspace: string
  metadata?: Record<string, unknown>
}
```

### 4.3 返回类型

```typescript
// 对外暴露的 Session 信息（getSession 返回）
interface SessionInfo {
  id: string
  sessionId: string
  workspace: string
  status: SessionStatus
  createdAt: number
  metadata?: Record<string, unknown>
}

// Session 元数据（listSessions 返回）
interface SessionMetadata {
  id: string
  workspace: string
  status: SessionStatus
  createdAt: number
  metadata?: Record<string, unknown>
}

// Session 状态
type SessionStatus = 'active' | 'paused' | 'destroyed'
```

### 4.4 错误处理

```typescript
// 错误码常量
const EngineErrorCode = {
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_WORKSPACE_CONFLICT: 'SESSION_WORKSPACE_CONFLICT',
  SESSION_LIMIT_EXCEEDED: 'SESSION_LIMIT_EXCEEDED',
  SESSION_ALREADY_DESTROYED: 'SESSION_ALREADY_DESTROYED',
  SESSION_CREATE_FAILED: 'SESSION_CREATE_FAILED',
  SESSION_OPERATION_FAILED: 'SESSION_OPERATION_FAILED',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  EXECUTION_ERROR: 'EXECUTION_ERROR',
} as const

// 错误类
class EngineError extends Error {
  readonly code: string
  constructor(code: string, message: string)
}
```

错误码与触发场景的对应关系：

| 错误码 | 触发场景 |
|--------|----------|
| `SESSION_NOT_FOUND` | 操作的 sessionId 在注册表中不存在 |
| `SESSION_WORKSPACE_CONFLICT` | 创建时 workspace 已被其他未销毁的 Session 占用 |
| `SESSION_LIMIT_EXCEEDED` | 创建时超过 maxConcurrentSessions 限制 |
| `SESSION_ALREADY_DESTROYED` | 对已销毁的 Session 执行暂停/恢复/销毁操作 |
| `SESSION_CREATE_FAILED` | 创建过程中发生未预期的内部错误 |
| `SESSION_OPERATION_FAILED` | 暂停/恢复/销毁过程中 Session 抛出异常 |

---

## 五、依赖关系

### 5.1 直接依赖

| 依赖模块 | 用途 |
|----------|------|
| `SessionManager` | Session 注册表操作（创建/获取/列表/暂停/恢复/销毁） |
| `Session` | 通过 SessionManager 间接操作，EngineFacade 不直接 import Session 类 |
| `types` | `SessionConfig`、`SessionManagerConfig`、`SessionMetadata`、`SessionStatus` 等类型 |

### 5.2 被依赖

| 上游模块 | 调用方式 |
|----------|----------|
| `AgentEngine` | AgentEngine 持有 EngineFacade 实例，将所有 Session 管理方法委托给它 |

### 5.3 不依赖

- 不依赖 `EventBus`（事件发射由 AgentEngine 负责）
- 不依赖 `Bridge`/`QueryEngine`（查询执行由 AgentEngine 负责）
- 不依赖 `SessionStore`（持久化由 SessionManager 负责）

---

## 六、设计决策

| 决策 | 理由 |
|------|------|
| Facade 模式封装 SessionManager | 将纯数据操作与业务逻辑（错误转换、信息投影）分离，SessionManager 保持纯粹 |
| 错误码而非异常链 | 通过 `EngineError.code` 携带语义化错误码，上层可精确匹配处理，不需要解析 message 文本 |
| 元数据独立 Map | `sessionMetadata` 与 Session 实例的 `_metadata` 分离存储，EngineFacade 管理使用者传入的业务元数据 |
| 静态方法签名（非异步）getSession/listSessions | 这些方法只做内存数据读取和投影，无 I/O，无需异步 |
| listSessions 支持 filter | 按常用维度（status、workspace）过滤，避免上层做二次筛选 |
