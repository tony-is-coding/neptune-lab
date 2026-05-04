> **文档状态**：✅ 已对齐代码 | 更新时间：2026-04-26
> **实现状态**：M1-M2 已完成，M3-M4 规划中

# Session Manager 设计文档

---

## 一、功能概述

### 1.1 功能目标
Session Manager 是 Agent Engine 的 Session 注册表和调度中心，负责管理多个 Session 的并发执行、生命周期控制和资源调度。

### 1.2 解决的问题
- **并发管理**：支持多个 Session 同时运行，避免资源竞争
- **生命周期控制**：统一管理 Session 的创建、暂停、恢复、销毁
- **Workspace 唯一性**：确保同一 workspace 只有一个活跃 Session
- **状态持久化**：可选通过 ISessionStore 实现元数据持久化

### 1.3 适用场景
- Web 服务需要处理多用户并发请求
- 任务系统需要调度多个 Agent 任务
- 桌面应用需要管理多个工作区
- CLI 工具需要支持后台 Session

---

## 二、设计目标

### 2.1 功能性目标
**✅ 已实现**：
- 支持 Session 并发（通过 `maxConcurrentSessions` 限制）
- 支持 Session 暂停/恢复/销毁
- Workspace 唯一性约束
- 可选的 ISessionStore 持久化

**[规划中]**：
- Session 优先级调度
- 等待队列机制
- Session 资源限制
- Session 超时控制

### 2.2 非功能性目标
- **性能**：Session 创建 < 100ms，切换 < 50ms
- **可靠性**：Session 状态不丢失，崩溃可恢复
- **可扩展性**：支持水平扩展，分布式部署
- **可观测性**：提供完整的监控和日志

### 2.3 约束条件
- Session = Workspace，一对一映射（同一 workspace 只能有一个活跃 Session）
- 不依赖 QueryEngine（QueryEngine 由 AgentEngine 管理）
- 可选通过 ISessionStore 进行元数据持久化

---

## 三、技术方案

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Session Manager                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Session 注册表 ✅ 已实现                              │  │
│  │  Map<sessionId, Session>                              │  │
│  │  - 活跃 Session 列表                                   │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ↓                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  并发控制 ✅ 已实现                                    │  │
│  │  - 最大并发数限制 (maxConcurrentSessions)             │  │
│  │  - Workspace 唯一性检查                                │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ↓                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  生命周期管理 ✅ 已实现                                │  │
│  │  - 创建：createSession()                              │  │
│  │  - 获取：getSession()                                 │  │
│  │  - 暂停：pauseSession()                               │  │
│  │  - 恢复：resumeSession()                              │  │
│  │  - 销毁：destroySession()                             │  │
│  │  - 列表：listSessions()                               │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ↓                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  持久化（可选）✅ 已实现                               │  │
│  │  - ISessionStore 注入                                 │  │
│  │  - syncToStore() 同步元数据                            │  │
│  │  - restoreFromStore() 恢复                             │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ↓                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  等待队列 [规划中]                                     │  │
│  │  - 优先级调度                                          │  │
│  │  - 超时控制                                            │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 核心流程

#### 3.2.1 创建 Session 流程

```
createSession(config)
    ↓
验证 workspace 唯一性（仅检查未销毁的 Session）
    ↓
检查并发限制（未销毁的 Session 计入名额）
    ↓
创建 Session（可选外部指定 sessionId）
    ↓
注册到 Session 注册表
    ↓
同步到 ISessionStore（如果已注入）
    ↓
返回 sessionId
```

#### 3.2.2 暂停/恢复流程

```
暂停：
  pauseSession(sessionId)
    ↓
  查找 Session
    ↓
  调用 session.pause()
    ↓
  同步到 ISessionStore

恢复：
  resumeSession(sessionId)
    ↓
  查找 Session
    ↓
  调用 session.resume()
    ↓
  同步到 ISessionStore
```

#### 3.2.3 并发控制流程 [规划中]

```
请求创建 Session
    ↓
检查当前活跃 Session 数
    ↓
是否超过限制？
    ├── 是 → 加入等待队列
    │         ↓
    │      等待 Session 释放
    │         ↓
    │      从队列取出并创建
    │
    └── 否 → 直接创建
```

### 3.3 数据结构

#### 3.3.1 SessionConfig ✅ 已实现

```typescript
interface SessionConfig {
  workspace: string
  metadata?: Record<string, unknown>
}
```

#### 3.3.2 SessionStatus ✅ 已实现

```typescript
type SessionStatus = 'active' | 'paused' | 'destroyed'
```

#### 3.3.3 SessionManagerConfig ✅ 已实现

```typescript
interface SessionManagerConfig {
  maxConcurrentSessions?: number  // 最大并发 Session 数
}
```

#### 3.3.4 SessionMetadata ✅ 已实现

```typescript
interface SessionMetadata {
  id: string
  workspace: string
  status: SessionStatus
  createdAt: number
  metadata?: Record<string, unknown>
}
```

#### 3.3.5 扩展配置 [规划中]

```typescript
// 未来版本可能添加的配置字段
interface SessionManagerConfigExtended {
  maxConcurrentSessions?: number
  maxSessionsPerWorkspace?: number    // 每个 workspace 最大 Session 数
  sessionTimeout?: number             // Session 超时时间（ms）
  autoSaveInterval?: number           // 自动保存间隔（ms）
  enableCrashRecovery?: boolean       // 是否启用崩溃恢复
}

// 未来版本可能扩展的元数据字段
interface SessionMetadataExtended {
  id: string
  workspace: string
  status: SessionStatus
  createdAt: number
  updatedAt?: number
  lastActiveAt?: number
  conversationLength?: number
  totalCost?: number
  metadata?: Record<string, unknown>
}
```

---

## 四、接口设计

### 4.1 核心 API

```typescript
class SessionManager {
  // ✅ 创建 Session（同步，返回 sessionId）
  createSession(config: SessionConfig & { sessionId?: string }): string

  // ✅ 获取 Session
  getSession(sessionId: string): Session | undefined

  // ✅ 列出所有 Session
  listSessions(): Session[]

  // ✅ 暂停 Session（同步）
  pauseSession(sessionId: string): void

  // ✅ 恢复 Session（同步）
  resumeSession(sessionId: string): void

  // ✅ 销毁 Session（同步）
  destroySession(sessionId: string): void

  // ✅ 从 Store 恢复所有 Session（异步）
  restoreFromStore(): Promise<void>

  // [规划中] 追加事件
  // appendEvent(sessionId: string, event: Event): Promise<void>

  // [规划中] 获取统计信息
  // getStats(): SessionManagerStats
}
```

### 4.2 参数说明

**createSession**
- `config.workspace`: 必填，工作目录路径
- `config.metadata`: 可选，业务元数据
- `config.sessionId`: 可选，外部指定的 sessionId
- 返回：sessionId
- 错误：`SESSION_WORKSPACE_CONFLICT`, `SESSION_LIMIT_EXCEEDED`

**getSession**
- `sessionId`: 必填，Session ID
- 返回：Session 或 undefined

**pauseSession**
- `sessionId`: 必填，Session ID
- 行为：暂停 Session，同步到 Store
- 错误：`SESSION_NOT_FOUND`

**resumeSession**
- `sessionId`: 必填，Session ID
- 行为：恢复 Session，同步到 Store
- 错误：`SESSION_NOT_FOUND`

**destroySession**
- `sessionId`: 必填，Session ID
- 行为：销毁 Session，同步到 Store
- 错误：`SESSION_NOT_FOUND`

**listSessions**
- 返回：所有 Session 的数组

**restoreFromStore**
- 行为：从 ISessionStore 恢复所有 Session（异步）

### 4.3 错误处理

```typescript
// ✅ 已实现的错误码
const EngineErrorCode = {
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_WORKSPACE_CONFLICT: 'SESSION_WORKSPACE_CONFLICT',
  SESSION_LIMIT_EXCEEDED: 'SESSION_LIMIT_EXCEEDED',
  SESSION_ALREADY_DESTROYED: 'SESSION_ALREADY_DESTROYED',
  SESSION_CREATE_FAILED: 'SESSION_CREATE_FAILED',
  SESSION_OPERATION_FAILED: 'SESSION_OPERATION_FAILED',
  // ... 其他错误码
}
```

---

## 五、实现计划

### 5.1 实现状态

**✅ 已完成（M1-M2）**：
- SessionManager 类骨架
- Session 注册表（Map）
- `createSession` / `getSession` / `listSessions`
- `pauseSession` / `resumeSession` / `destroySession`
- Workspace 唯一性检查
- 并发限制检查
- ISessionStore 集成（`syncToStore`, `restoreFromStore`）
- 基础测试

**[规划中] M3：并发控制增强**：
- 等待队列机制
- 优先级调度
- 超时控制

**[规划中] M4：高级特性**：
- 自动保存间隔
- 崩溃恢复
- 统计信息（`getStats`）
- 事件追加（`appendEvent`）

### 5.2 依赖关系

```
SessionManager
  ├── ✅ 可选依赖 ISessionStore（已实现）
  └── [规划中] 依赖 EventBus（M3-M4）
```

### 5.3 里程碑

- **✅ M1**：基础注册表（create, get, list）- 已完成
- **✅ M2**：生命周期管理（pause, resume, destroy）- 已完成
- **M3**：并发控制增强（等待队列、优先级调度）- 规划中
- **M4**：状态持久化增强（自动保存、崩溃恢复、统计）- 规划中

---

## 六、测试计划

### 6.1 测试策略

- **单元测试**：测试每个方法的基本功能
- **集成测试**：测试与 ISessionStore 的集成
- **并发测试**：测试多 Session 并发场景
- **压力测试**：测试极限并发和资源限制

### 6.2 测试用例

**✅ 已实现（M1-M2）**
- 创建 Session 成功
- 创建重复 workspace 失败（抛出 `SESSION_WORKSPACE_CONFLICT`）
- 达到最大并发限制（抛出 `SESSION_LIMIT_EXCEEDED`）
- 获取 Session 成功
- 获取不存在的 Session（返回 undefined）
- 暂停 Session
- 恢复 Session
- 销毁 Session
- 列出所有 Session
- Workspace 唯一性检查（仅检查未销毁的 Session）
- 并发限制检查（未销毁的 Session 计入名额）
- ISessionStore 同步

**[规划中] M3：并发控制增强**
- 等待队列正常工作
- 优先级调度正确
- Session 超时处理

**[规划中] M4：高级特性**
- 自动保存状态
- 崩溃后恢复
- 跨进程迁移
- 统计信息正确

### 6.3 验收标准

**M1-M2（已完成）**：
- 基础功能测试通过
- 生命周期测试通过
- 并发限制测试通过
- Workspace 唯一性测试通过

**M3-M4（规划中）**：
- 所有单元测试通过
- 所有集成测试通过
- 代码覆盖率 > 80%
- 支持 100+ 并发 Session
- Session 创建时间 < 100ms
- Session 切换时间 < 50ms
- 崩溃恢复成功率 > 99%
