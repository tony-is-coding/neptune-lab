> **文档状态**：✅ 最新 | 更新时间：2026-04-25

# 数据流设计文档

---

## 一、文档定位

本文档描述 Agent Engine 框架中从 `engine.query()` 调用到 Message 产出的完整数据流转路径。

核心决策：
- **事件完全透传** Claude Code 原始 Message，不自建事件模型
- **Adapter 层移出框架**，HTTP/SSE/CLI 由使用者自行实现
- **query() 双路输出**：AsyncGenerator yield（拉模式）+ EventBus emit（推模式）

---

## 二、query 数据流总览

```
使用者代码
    │
    │  engine.query(sessionId, input)
    ↓
┌─────────────────────────────────────────────────────────┐
│  1. 前置校验                                             │
│     assertNotDestroyed()                                 │
│     facade.getSession(sessionId) → 验证存在 & 未销毁      │
└──────────────────────────┬──────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  2. 运行时初始化（仅首次）                                 │
│     initializeRuntime(workspace)                         │
│       ├─ injectMacroDefines()                            │
│       ├─ enableConfigs()                                 │
│       └─ setCwdState / setProjectRoot                    │
└──────────────────────────┬──────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  3. 获取/创建 per-session QueryEngine                     │
│     queryEngines.get(sessionId)                          │
│     不存在时：                                            │
│       ├─ 取 sessionMessages（会话恢复场景，取后删除）      │
│       ├─ 解析 systemPrompt（session级 > engine级）        │
│       ├─ buildQueryEngineConfig({ cwd, tools, ... })     │
│       │    ├─ getDefaultAppState()                       │
│       │    ├─ getAllBaseTools() + adaptToolExtension()    │
│       │    └─ 组装 QueryEngineConfig                     │
│       └─ new QueryEngine(config) → 缓存                  │
└──────────────────────────┬──────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  4. 调用 CC 原始 QueryEngine.submitMessage(input)        │
│     CC 内部执行循环：                                     │
│       while (true) {                                     │
│         压缩上下文 → LLM API → 工具执行 → 判断继续/终止   │
│       }                                                  │
│     产出：AsyncGenerator<Message>                        │
└──────────────────────────┬──────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  5. 双路输出（同一条 Message）                             │
│     for await (const message of qe.submitMessage()) {   │
│       yield message         → 拉模式，调用者 for-await   │
│     }                                                    │
│     注：EventBus emit 由上层桥接完成                      │
└─────────────────────────────────────────────────────────┘
```

---

## 三、事件双路输出

### 3.1 推模式与拉模式

同一条 Message 存在两种消费方式，使用者按需选择：

| 模式 | 机制 | 适用场景 | 示例 |
|------|------|----------|------|
| **拉模式** | `for await (const msg of engine.query(...))` | 单次查询的同步处理 | CLI 逐行显示 |
| **推模式** | `engine.on(type, handler)` | 全局事件监听、跨 Session 观察 | SSE 推送、日志收集 |

```typescript
// 拉模式：单次查询内同步消费
for await (const message of engine.query(sessionId, '分析代码')) {
  // message 是 CC 原始 Message，直接使用
  handleResponse(message)
}

// 推模式：全局监听，不依赖 query 调用
engine.on('assistant', (msg) => { /* 助手回复 */ })
engine.on('tool_result', (msg) => { /* 工具结果 */ })
engine.on('session:created', (payload) => { /* 生命周期 */ })
```

### 3.2 EventBus 事件来源

| 来源 | 事件类型 | 触发时机 |
|------|----------|----------|
| **CC 原始 Message** | 透传 `submitMessage()` 产出的 Message | query 执行期间 |
| **框架生命周期** | `session:created`, `session:paused`, `session:resumed`, `session:destroyed` | Session 状态变更时 |

### 3.3 EventBus 核心能力

```typescript
// Session 级过滤（只收特定 Session 的事件）
engine.getEventBus().subscribe('assistant', handler, { sessionId: 'xxx' })

// Hook 拦截（返回 false 阻止传播）
engine.getEventBus().hook('assistant', (msg) => {
  if (shouldBlock(msg)) return false  // 阻止后续监听器
  return true                          // 继续传播
})
```

---

## 四、会话恢复数据流

```
engine.loadSession({ workspace })
    │
    ├─ 1. 定位 transcript.jsonl
    │     ├─ CC 标准路径：~/.claude/projects/{sanitized-workspace}/*.jsonl
    │     └─ fallback：workspace/transcript.jsonl
    │
    ├─ 2. 解析历史消息
    │     ├─ 优先：CC 原始 loadTranscriptFromFile()
    │     └─ fallback：TranscriptParser（简单 JSONL 解析）
    │
    ├─ 3. 创建新 Session
    │     └─ engine.createSession({ workspace }) → sessionId
    │
    └─ 4. 缓存历史消息（等待首次 query 消费）
          └─ sessionMessages.set(sessionId, messages)
                │
                │  首次 engine.query(sessionId, ...) 时
                ↓
          buildQueryEngineConfig({ initialMessages })
                │
                └─ new QueryEngine(config)  ← 携带完整对话链
```

**关键点**：
- 历史消息仅在首次 `query()` 时消费，取后即删
- `QueryEngine` 通过 `initialMessages` 参数恢复完整对话上下文
- 后续 `query()` 调用复用同一个 `QueryEngine` 实例（per-session 缓存）

---

## 五、伪代码

### 5.1 query 核心流程

```typescript
async *query(sessionId: string, input: string): AsyncGenerator<Message> {
  // 1. 校验
  const session = this.facade.getSession(sessionId)
  if (!session) throw new EngineError('SESSION_NOT_FOUND', ...)

  // 2. 初始化运行时（幂等，仅首次生效）
  initializeRuntime(session.workspace)

  // 3. 获取/创建 QueryEngine（per-session 单例）
  let qe = this.queryEngines.get(sessionId)
  if (!qe) {
    const initialMessages = this.sessionMessages.get(sessionId)  // 会话恢复
    this.sessionMessages.delete(sessionId)                        // 取后即删

    const config = buildQueryEngineConfig({
      cwd: session.workspace,
      systemPrompt: this.sessionPrompts.get(sessionId) ?? this.config.systemPrompt,
      tools: this.config.extensions?.tools,
      initialMessages,
    })
    qe = new QueryEngine(config)
    this.queryEngines.set(sessionId, qe)
  }

  // 4. 调用 CC 原始执行循环，透传 Message
  for await (const message of qe.submitMessage(input)) {
    yield message  // 拉模式：调用者通过 for-await 消费
  }
}
```

### 5.2 使用者侧桥接 EventBus（推模式）

```typescript
// 使用者在调用 query 的同时，可自行桥接到 EventBus
async function queryWithEvents(sessionId: string, input: string) {
  for await (const message of engine.query(sessionId, input)) {
    // 推模式：同步 emit 到 EventBus
    engine.getEventBus().emit(message.type, message, sessionId)
  }
}
```

---

## 六、数据流边界说明

| 边界 | 位置 | 说明 |
|------|------|------|
| **使用者 → 框架** | `engine.query(sessionId, input)` | 输入为纯字符串，框架不做协议转换 |
| **框架 → CC** | `buildQueryEngineConfig()` → `new QueryEngine()` | Bridge 层构造配置，直接使用 CC 原始能力 |
| **CC → 框架** | `QueryEngine.submitMessage()` 产出 `Message` | 原始 Message，无类型转换 |
| **框架 → 使用者** | `yield message` + `EventBus.emit()` | 双路输出，使用者按需消费 |
| **传输层** | 框架外，使用者自行实现 | HTTP/SSE/CLI 不在框架范围内 |

---

## 七、关键设计决策

| 决策 | 理由 |
|------|------|
| 事件完全透传 CC 原始 Message | 避免自建事件模型的类型转换复杂度，使用者直接处理 CC Message |
| Adapter 移出框架 | HTTP/SSE/CLI 是使用者侧的传输实现，不属于 Agent Engine SDK 范畴 |
| per-session QueryEngine 缓存 | 保持多轮对话上下文，QueryEngine 实例内部维护对话状态 |
| 会话恢复使用 initialMessages | 利用 CC 原生机制恢复对话链，不重复造轮子 |
| systemPrompt 支持函数 | 支持异步加载提示词（如从远程拉取），增加灵活性 |
