> **文档状态**：✅ 最新 | 更新时间：2026-04-25

# Session Store 设计文档

## 一、功能定位

SessionStore 负责 **Session 元数据的持久化存储**，是框架存储层的唯一组件。

核心边界：**只存元数据，不存会话内容**。

| 数据类型 | 管理方 | 说明 |
|----------|--------|------|
| Session 元数据 | **框架 SessionStore** | sessionId、workspace、status、metadata |
| 会话内容（对话链） | **Claude Code 原始** | transcript.jsonl，框架不重复存储 |
| 工具执行产物 | **使用者** | 框架不负责 |

## 二、接口定义

与代码 `src/engine/storage/ISessionStore.ts` 保持一致：

```typescript
interface ISessionStore {
  /** 保存 Session（已存在则覆盖） */
  save(session: Session): Promise<void>
  /** 按 sessionId 加载，不存在返回 null */
  load(sessionId: string): Promise<Session | null>
  /** 按 sessionId 删除，不存在不报错 */
  delete(sessionId: string): Promise<void>
  /** 列出所有已保存的 Session */
  list(): Promise<Session[]>
}
```

设计要点：
- 所有方法返回 Promise，天然支持异步后端
- 操作对象是 `Session` 实体（非原始 JSON），InMemory 实现直接存引用
- 接口极简，4 个方法覆盖完整 CRUD

## 三、实现方案

### 3.1 InMemorySessionStore（默认实现）

- 存储：`Map<string, Session>`
- 特点：进程内存储，save 即 upsert，进程退出数据丢失
- 适用：测试环境、短生命周期场景

代码位于 `src/engine/storage/InMemorySessionStore.ts`。

### 3.2 SQLiteSessionStore（可选实现）

- 存储：SQLite 单表，存储 Session 快照（sessionId、workspace、status、metadata）
- 特点：进程退出数据不丢失，适合生产环境
- 状态：规划中，按需实现

## 四、数据流

```
SessionManager 创建/更新 Session
         │
         ▼
   EngineFacade 业务逻辑
         │
         ▼
   ISessionStore.save(session)   ← 只存元数据快照

   ─── 会话内容由 CC 原始管理 ───
   QueryEngine.submitMessage()
         │
         ▼
   transcript.jsonl（CC 原始路径，框架不干预）
```

## 五、Session 快照结构

Session 实体通过 `toSnapshot()` / `restore()` 进行持久化往返：

```typescript
interface SessionSnapshot {
  sessionId: string
  workspace: string
  createdAt: number
  status: SessionStatus          // 'active' | 'paused' | 'destroyed'
  metadata: Record<string, unknown>
}
```

> 注：SessionSnapshot 只存元数据。会话内容（对话链）由 CC 原始 transcript.jsonl 管理，框架不重复存储。

## 六、使用示例

```typescript
// 注入 InMemory 存储（默认）
const engine = AgentEngine.create({ /* config */ })

// 或注入自定义存储
const store = new SQLiteSessionStore({ path: './data/sessions.db' })
// store 通过 config 注入（按需扩展）
```

## 七、设计决策

| 决策 | 理由 |
|------|------|
| 只存元数据 | 会话内容由 CC transcript.jsonl 管理，避免重复存储和数据不一致 |
| 接口极简（4 方法） | Session CRUD 足够，不过度设计 |
| 默认 InMemory | 零依赖，测试友好，生产环境按需替换 |
| 操作 Session 实体 | 保持类型安全，避免裸 JSON 丢失行为方法 |
