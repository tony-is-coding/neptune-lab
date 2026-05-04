> **文档状态**：✅ 最新 | 更新时间：2026-04-26

# Session 设计文档

---

## 一、功能概述

### 1.1 功能定位
Session 是 Agent Engine 的**纯数据实体**，只负责存储会话的标识和元数据信息。它不依赖任何 LLM 或外部服务，不管理对话历史，也不直接负责持久化。

### 1.2 解决的问题
- **会话标识**：为每个工作区会话提供唯一的 sessionId
- **元数据管理**：提供可扩展的 metadata 存储，支持业务字段注入
- **生命周期表达**：通过 status 字段表达 Session 的生命周期状态
- **序列化支持**：通过快照/恢复机制支持跨进程传输和持久化

### 1.3 不负责的职责
- 对话历史管理（由 QueryEngine 和 CC transcript 层负责）
- 持久化存储（由 SessionManager 通过 ISessionStore 负责）
- 运行时状态（成本统计、Token 统计等，不属于 Session 数据实体）
- JSONL 文件读写（由 CC 原始层负责）

---

## 二、设计目标

### 2.1 功能性目标
- Session = Workspace，一对一映射
- 支持生命周期状态管理（active / paused / destroyed）
- 支持快照导出和恢复，便于持久化
- 支持通过 metadata 注入业务字段

### 2.2 非功能性目标
- **简洁性**：纯数据实体，无副作用，无异步操作
- **可序列化**：所有字段可 JSON 序列化，支持跨进程传输
- **不变性**：核心标识字段（sessionId、workspace、createdAt）为 readonly

### 2.3 约束条件
- 框架不包含业务字段（userId、tenantId 等），业务字段通过 metadata 注入
- destroyed 状态不可逆，所有写操作在 destroyed 后抛出异常

---

## 三、技术方案

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Session（纯数据实体）                       │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  核心标识（readonly）                                   │  │
│  │  - sessionId: string                                  │  │
│  │  - workspace: string                                  │  │
│  │  - createdAt: number                                  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  生命周期状态                                          │  │
│  │  - _status: SessionStatus (private)                   │  │
│  │    'active' → 'paused' → 'destroyed'                  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  扩展元数据                                            │  │
│  │  - _metadata: Record<string, unknown> (private)       │  │
│  │  - 业务字段通过 setMetadata / getMetadata 访问        │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         │                              │
    toSnapshot()                  static restore()
         │                              │
         ↓                              ↓
  ┌─────────────────────────────────────────────────────────┐
  │              SessionSnapshot（序列化结构）                 │
  │  - sessionId / workspace / createdAt / status / metadata │
  └─────────────────────────────────────────────────────────┘
                           ↕
  ┌─────────────────────────────────────────────────────────┐
  │        SessionManager（通过 ISessionStore 持久化）        │
  │  - 创建/获取/暂停/恢复/销毁 Session                      │
  │  - 持久化由 SessionManager 委托 ISessionStore 处理       │
  └─────────────────────────────────────────────────────────┘
```

### 3.2 核心流程

#### 3.2.1 Session 创建流程

```
new Session(config, sessionId?)
    ↓
初始化核心标识
    ├── sessionId = sessionId ?? randomUUID()
    ├── workspace = config.workspace
    └── createdAt = Date.now()
    ↓
初始化可变状态
    ├── _status = 'active'
    └── _metadata = {}
    ↓
返回 Session 实例
```

#### 3.2.2 生命周期状态机

```
                    pause()
  ┌──────────┐ ──────────────→ ┌──────────┐
  │  active  │                 │  paused  │
  └──────────┘ ←────────────── └──────────┘
                    resume()

      │                            │
      │       destroy()            │  destroy()
      │                            │
      ↓                            ↓
  ┌──────────────────────────────────┐
  │           destroyed              │  ← 不可逆终态
  └──────────────────────────────────┘

  规则：
  - destroy() 不可逆，进入 destroyed 后所有写操作抛异常
  - pause() 对已暂停状态无副作用
  - resume() 对已激活状态无副作用
  - 对 destroyed 状态调用任何生命周期方法均抛异常
```

#### 3.2.3 快照/恢复流程

```
导出快照 toSnapshot():
  Session 实例
      ↓
  构建 SessionSnapshot
      ├── sessionId（readonly，直接复制）
      ├── workspace（readonly，直接复制）
      ├── createdAt（readonly，直接复制）
      ├── status（private _status）
      └── metadata（浅拷贝 _metadata）
      ↓
  返回纯数据对象（可 JSON 序列化）

恢复快照 static restore(snapshot):
  SessionSnapshot 数据
      ↓
  Object.create(Session.prototype) 绕过构造函数
      ↓
  直接赋值所有字段
      ├── sessionId / workspace / createdAt（标识字段）
      ├── _status（状态字段）
      └── _metadata = { ...snapshot.metadata }（浅拷贝）
      ↓
  返回 Session 实例
```

#### 3.2.4 持久化流程（由 SessionManager 负责）

```
持久化：
  SessionManager 调用 session.toSnapshot()
      ↓
  将 SessionSnapshot 传给 ISessionStore
      ↓
  ISessionStore 实现具体的存储逻辑

恢复：
  ISessionStore 读取存储的快照数据
      ↓
  返回 SessionSnapshot 给 SessionManager
      ↓
  Session.restore(snapshot) 重建 Session 实例
```

### 3.3 数据结构

#### 3.3.1 Session 字段

| 字段 | 类型 | 可见性 | 说明 |
|------|------|--------|------|
| sessionId | string | readonly public | 会话唯一标识，构造时自动生成 UUID 或由参数指定 |
| workspace | string | readonly public | 工作目录路径，Session 与 Workspace 一对一映射 |
| createdAt | number | readonly public | 创建时间戳（Date.now()） |
| _status | SessionStatus | private | 生命周期状态，通过 getter 和方法访问 |
| _metadata | Record\<string, unknown\> | private | 扩展元数据，通过 getMetadata / setMetadata 访问 |

#### 3.3.2 SessionStatus

```typescript
type SessionStatus = 'active' | 'paused' | 'destroyed'
```

#### 3.3.3 SessionConfig

```typescript
interface SessionConfig {
  workspace: string                        // 必填，工作目录路径
  metadata?: Record<string, unknown>       // 可选，初始元数据
}
```

#### 3.3.4 SessionSnapshot

```typescript
interface SessionSnapshot {
  sessionId: string
  workspace: string
  createdAt: number
  status: SessionStatus
  metadata: Record<string, unknown>
}
```

---

## 四、接口设计

### 4.1 核心 API

```typescript
class Session {
  // ---- 构造与恢复 ----

  /** 创建 Session 实例 */
  constructor(config: SessionConfig, sessionId?: string)

  /** 从快照恢复 Session 实例（绕过构造函数，直接赋值所有字段） */
  static restore(snapshot: SessionSnapshot): Session

  // ---- 快照导出 ----

  /** 导出快照数据（用于持久化保存），metadata 为浅拷贝 */
  toSnapshot(): SessionSnapshot

  // ---- 生命周期管理 ----

  /** 暂停 Session，已暂停则无副作用 */
  pause(): void

  /** 恢复 Session，已激活则无副作用 */
  resume(): void

  /** 销毁 Session，不可逆，之后所有写操作抛异常 */
  destroy(): void

  // ---- 属性访问 ----

  /** 获取当前状态 */
  get status(): SessionStatus

  /** 获取全部 metadata（返回浅拷贝） */
  getMetadata(): Record<string, unknown>

  /** 获取指定 key 的 metadata 值 */
  getMetadata(key: string): unknown
}
```

### 4.2 参数说明

**constructor(config, sessionId?)**
- `config.workspace`: 必填，工作目录路径
- `sessionId`: 可选，不传则自动生成 UUID
- 初始 status 为 `'active'`，初始 metadata 为 `{}`

**setMetadata(key, value)**
- `key`: 必填，元数据键名
- `value`: 必填，元数据值（unknown 类型）
- destroyed 状态下抛出异常

**getMetadata()**
- 无参数：返回全部 metadata 的浅拷贝
- 传 key：返回指定 key 的值

### 4.3 错误处理

Session 内部不做错误码枚举，通过异常消息区分：

| 场景 | 异常消息 |
|------|----------|
| 对 destroyed Session 调用 pause() | `'不可操作已销毁的 Session'` |
| 对 destroyed Session 调用 resume() | `'不可操作已销毁的 Session'` |
| 对 destroyed Session 调用 setMetadata() | `'不可操作已销毁的 Session'` |
| 对 destroyed Session 调用 destroy() | `'Session 已销毁，不可重复销毁'` |

---

## 五、设计决策

### 5.1 为什么选择纯数据实体

| 决策 | 理由 |
|------|------|
| 不包含对话历史 | 对话历史由 QueryEngine 和 CC transcript 层管理，Session 只关心会话元数据，避免职责膨胀 |
| 不直接持久化 | 持久化委托给 SessionManager + ISessionStore，Session 自身无 IO 副作用，便于测试和跨环境使用 |
| 不包含运行时统计 | 成本、Token 等运行时状态属于查询层面的统计，不属于会话实体本身 |
| 核心字段 readonly | sessionId、workspace、createdAt 一旦确定不可修改，保证数据一致性 |
| 状态通过方法变更 | status 通过 pause/resume/destroy 方法变更而非直接赋值，可以在状态转换时加入校验逻辑 |
| 快照/恢复模式 | 通过 toSnapshot/restore 实现，不依赖构造函数恢复，保持灵活性 |

### 5.2 与其他组件的关系

```
Session（纯数据实体）
    ↑ 被管理
SessionManager（注册表和调度中心）
    ├── 创建 Session 实例
    ├── 调用 session.toSnapshot() 持久化
    ├── 调用 Session.restore(snapshot) 恢复
    └── 通过 ISessionStore 处理实际 IO
```

---

## 六、测试计划

### 6.1 测试策略

- **单元测试**：测试 Session 所有方法的基本功能和边界条件
- **快照测试**：测试 toSnapshot/restore 的往返一致性

### 6.2 测试用例

**创建与标识测试**
- 使用自动生成的 sessionId 创建 Session
- 使用指定的 sessionId 创建 Session
- 验证核心标识字段（sessionId、workspace、createdAt）为 readonly

**生命周期状态测试**
- 初始状态为 active
- active → paused（pause 调用）
- paused → active（resume 调用）
- active → destroyed（destroy 调用）
- pause 对已暂停状态无副作用
- resume 对已激活状态无副作用
- destroyed 状态下调用 pause/resume/setMetadata/destroy 均抛异常

**元数据管理测试**
- setMetadata / getMetadata 基本功能
- getMetadata() 无参数返回全部 metadata 的浅拷贝
- getMetadata(key) 返回指定值
- destroyed 状态下 setMetadata 抛异常

**快照/恢复测试**
- toSnapshot 输出与 Session 字段一致
- toSnapshot 中 metadata 为浅拷贝（修改快照不影响原 Session）
- restore 从快照正确恢复所有字段
- toSnapshot → restore 往返一致性

### 6.3 验收标准

- 所有单元测试通过
- 代码覆盖率 > 90%
- Session 类无外部依赖（仅依赖 crypto/randomUUID 和本地类型）
- 无异步操作，无 IO 副作用
