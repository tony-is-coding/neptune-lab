# 记忆系统扩展点 + 会话产物管理 设计方案

更新时间：2026-04-23

---

## 一、记忆系统扩展点

### 1.1 Claude Code 原始记忆系统分析

Claude Code 的记忆系统位于 `src/memdir/`，核心机制：

- **存储**：`~/.claude/memory/` 目录下的 markdown 文件，每个记忆一个文件，带 frontmatter（name/description/type）
- **索引**：`MEMORY.md` 作为入口文件，最多 200 行，每行指向一个记忆文件
- **加载**：`loadMemoryPrompt()` 读取 MEMORY.md + 所有记忆文件，拼接为系统提示词的一部分
- **写入**：LLM 通过 Write 工具直接写入记忆文件
- **类型**：user（用户画像）、feedback（行为反馈）、project（项目上下文）、reference（外部引用）
- **路径**：`getAutoMemPath()` 返回 `~/.claude/projects/{projectDir}/memory/`，绑定项目目录

**关键限制**：
- 路径绑定到 `~/.claude/` 和项目目录，无法自定义
- 单用户模型，无租户/用户隔离
- 加载策略固定（全量加载），无优先级机制

### 1.2 问题诊断

| 场景 | 需求 | 当前状态 |
|------|------|----------|
| ToC 个人用户 | 加载个人记忆 | 部分满足（绑定 ~/.claude） |
| ToB 租户 | 加载租户级 + 个人级记忆 | 不支持 |
| 多用户系统 | 用户间记忆隔离 | 不支持 |
| 自定义存储 | 记忆存 DB/Redis | 不支持（只支持文件） |
| 优先级合并 | 租户规则 > 个人偏好 | 不支持 |

### 1.3 IMemoryProvider 接口设计

框架只提供通用的记忆存储/加载接口，不关心具体的作用域语义（用户/租户/项目等由开发者自行定义）。

```typescript
/**
 * 记忆条目
 */
interface MemoryEntry {
  id: string
  name: string
  description: string
  type: string                          // 开发者自定义类型
  content: string
  tags?: string[]                       // 可选标签，用于分类和检索
  createdAt: number
  updatedAt: number
  metadata?: Record<string, unknown>    // 开发者自定义元数据（如 scope、priority 等）
}

/**
 * 记忆提供者接口
 *
 * 框架只定义存储和加载的契约，不规定作用域、优先级等业务语义。
 * 开发者通过实现此接口，自行决定：
 * - 记忆存在哪里（文件/DB/Redis）
 * - 按什么维度加载（个人/租户/全局）
 * - 如何合并和排序（优先级策略）
 */
interface IMemoryProvider {
  /** 加载记忆 — 返回当前上下文应该使用的记忆列表 */
  loadMemories(): Promise<MemoryEntry[]>

  /** 保存记忆 */
  saveMemory(entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<string>

  /** 更新记忆 */
  updateMemory(id: string, updates: Partial<MemoryEntry>): Promise<void>

  /** 删除记忆 */
  deleteMemory(id: string): Promise<void>

  /** 搜索记忆（可选） */
  searchMemories?(query: string): Promise<MemoryEntry[]>
}
```

**设计原则**：
- `loadMemories()` 无参数 — 开发者在构造 Provider 时注入上下文（userId、tenantId 等），框架不感知
- `metadata` 字段开放 — 开发者可以存任何业务属性（scope、priority、source 等）
- 框架只消费 `loadMemories()` 的返回值，将其拼接为系统提示词

### 1.4 开发者使用示例

```typescript
// ToC 场景：个人记忆
class PersonalMemoryProvider implements IMemoryProvider {
  constructor(private userId: string, private db: Database) {}

  async loadMemories() {
    return this.db.query('SELECT * FROM memories WHERE user_id = ?', [this.userId])
  }
  // ...
}

// ToB 场景：租户 + 个人，租户优先
class TenantMemoryProvider implements IMemoryProvider {
  constructor(private userId: string, private tenantId: string, private db: Database) {}

  async loadMemories() {
    const tenantMem = await this.db.query('SELECT * FROM memories WHERE tenant_id = ?', [this.tenantId])
    const personalMem = await this.db.query('SELECT * FROM memories WHERE user_id = ?', [this.userId])
    // 开发者自行决定合并策略
    const tenantNames = new Set(tenantMem.map(m => m.name))
    return [...tenantMem, ...personalMem.filter(m => !tenantNames.has(m.name))]
  }
  // ...
}

// 使用
const engine = AgentEngine.create({
  memory: {
    provider: new TenantMemoryProvider(userId, tenantId, db),
  },
})
```

### 1.5 与 AgentEngine 集成方案

```typescript
interface AgentEngineConfig {
  // ... 现有配置

  /** 记忆系统扩展点（可选） */
  memory?: {
    provider: IMemoryProvider
  }
}
```

集成方式：在 `buildQueryEngineConfig()` 中，将记忆内容拼接到 `customSystemPrompt`：

```typescript
// OriginalQueryEngineBridge.ts
if (options.memory?.provider) {
  const memories = await options.memory.provider.loadMemories()
  const memoryPrompt = formatMemoriesAsPrompt(memories)
  systemPrompt = systemPrompt + '\n\n' + memoryPrompt
}
```

**包装不替代**：不修改 Claude Code 原始的 memdir 系统。我们在桥接层将记忆内容注入到 `customSystemPrompt`，Claude Code 原始的 `loadMemoryPrompt()` 仍然正常工作。

### 1.6 实现步骤

1. 定义 `IMemoryProvider` 接口和 `MemoryEntry` 类型
2. 实现 `FileMemoryProvider`（兼容 Claude Code 原始 memdir 格式，作为默认实现）
3. 修改 `AgentEngineConfig` 添加 `memory` 扩展点
4. 修改 `OriginalQueryEngineBridge` 在构造 systemPrompt 时调用 `provider.loadMemories()` 注入记忆
5. 编写测试

---

## 二、会话产物管理

### 2.1 关键发现

Claude Code 原始 QueryEngine 内部的 `recordTranscript()` 已经在自动持久化对话内容到 `~/.claude/projects/{workspace}/` 下的 JSONL 文件。每条消息（user/assistant/system/tool_use/tool_result）都会被追加记录。

**核心结论：我们不需要自建对话内容存储层，Claude Code 已经在做这件事。**

### 2.2 实际需要解决的问题

| 问题 | 说明 |
|------|------|
| 存储路径不可控 | 固定在 `~/.claude/projects/`，路径由 workspace 参数经过 sanitize 后决定，框架无法自定义存储根目录 |
| 无用户隔离 | 按 workspace 路径组织，不是按 userId/sessionId，多用户场景下所有会话混在一起 |
| 无恢复加载 | 框架层没有利用这些已存储的 JSONL 文件来恢复会话上下文，用户切换回旧会话时无法继续 |

### 2.3 方案：通过 workspace 参数控制存储路径

Claude Code 的 `recordTranscript()` 使用 workspace 路径来决定 JSONL 文件的存储位置。框架通过构造 workspace 参数，间接实现用户隔离和路径组织。

**策略**：将 `{rootDir}/{userId}/{sessionId}/` 作为 workspace 传入 QueryEngine。

```typescript
// 创建会话时，构造 workspace 路径实现用户隔离
const session = await engine.createSession({
  userId: 'alice',
  sessionId: 'sess_abc123',
  workspace: `${rootDir}/alice/sess_abc123/`,
})
```

**存储效果**：

```
~/.claude/projects/
├── {sanitized-rootDir}-alice-sess_abc123/    # Claude Code 自动 sanitize workspace 路径
│   ├── {sessionId}.jsonl                     # recordTranscript() 自动写入
│   └── ...
├── {sanitized-rootDir}-alice-sess_def456/
│   └── ...
└── {sanitized-rootDir}-bob-sess_ghi789/
    └── ...
```

**框架提供工具函数**，用于根据 workspace 定位 Claude Code 的实际存储路径：

```typescript
/**
 * 根据 workspace 获取 Claude Code 实际存储路径
 * Claude Code 内部会对 workspace 路径做 sanitize（替换特殊字符等）
 */
function getSessionStoragePath(workspace: string): string {
  // 复用 Claude Code 的 getSessionProjectDir() 逻辑
  // 返回 ~/.claude/projects/{sanitized-workspace}/
}
```

### 2.4 方案：会话恢复

当用户切换回旧会话时，框架从 Claude Code 已存储的 JSONL 文件中加载历史对话，注入到新的 QueryEngine 实例。

**恢复流程**：

```
用户切换到旧会话（提供 userId + sessionId）
  ↓
1. 根据 workspace 定位 JSONL 文件
   → getSessionStoragePath('{rootDir}/{userId}/{sessionId}/')
  ↓
2. 读取并解析 JSONL 文件
   → 逐行解析为 Message[]
  ↓
3. 注入到 QueryEngine 的 initialMessages
   → QueryEngineConfig.initialMessages = parsedMessages
  ↓
4. 创建新的 QueryEngine 实例（带历史上下文）
  ↓
5. 用户继续对话，Claude Code 继续追加到同一 JSONL 文件
```

**JSONL 解析工具**：

```typescript
/**
 * 解析 Claude Code 存储的 JSONL 对话文件
 * 
 * JSONL 文件中每行是一个 JSON 对象，包含 role、content、tool_use 等字段。
 * 此函数将其转换为 QueryEngine 可接受的 Message[] 格式。
 */
async function parseTranscriptJSONL(filePath: string): Promise<Message[]> {
  const lines = await readFileLines(filePath)
  return lines
    .filter(line => line.trim().length > 0)
    .map(line => JSON.parse(line))
    .map(entry => toQueryEngineMessage(entry))
}

/**
 * 将 JSONL 条目转换为 QueryEngine Message 格式
 * 需要处理：user / assistant / system / tool_use / tool_result 等类型
 */
function toQueryEngineMessage(entry: TranscriptEntry): Message {
  // 映射 Claude Code 的 transcript 格式到 QueryEngine 的 Message 格式
}
```

**使用示例**：

```typescript
// 恢复旧会话
const engine = AgentEngine.create({ /* ... */ })

const session = await engine.loadSession({
  userId: 'alice',
  sessionId: 'sess_abc123',
  workspace: `${rootDir}/alice/sess_abc123/`,
})
// 内部流程：
// 1. getSessionStoragePath(workspace) → 定位 JSONL 文件
// 2. parseTranscriptJSONL(jsonlPath) → 解析为 Message[]
// 3. 创建 QueryEngine({ initialMessages: parsedMessages, ... })

// 用户继续对话
for await (const event of session.query('继续上次的分析')) {
  // ...
}
```

### 2.5 实现步骤

1. **workspace 路径规范**：约定 `{rootDir}/{userId}/{sessionId}/` 作为 workspace 传入 QueryEngine，实现用户隔离
2. **实现 `getSessionStoragePath(workspace)`**：复用 Claude Code 的路径 sanitize 逻辑，根据 workspace 定位实际 JSONL 存储目录
3. **实现 JSONL 解析工具 `parseTranscriptJSONL()`**：读取 Claude Code 存储的 JSONL 文件，转换为 QueryEngine 可接受的 `Message[]` 格式
4. **修改 AgentEngine 支持会话恢复**：新增 `loadSession()` 方法，流程为 读取 JSONL → 解析 → 注入 `initialMessages` → 创建 QueryEngine
5. **编写测试**：覆盖 workspace 路径构造、JSONL 解析、会话恢复完整流程

### 2.6 框架改动评估

| 类型 | 内容 | 说明 |
|------|------|------|
| 新增 | `engine/session/TranscriptParser.ts` | JSONL 解析工具，将 Claude Code 的 transcript 文件转换为 Message[] |
| 新增 | `engine/session/SessionStoragePath.ts` | workspace → 实际存储路径的映射工具函数 |
| 修改 | `engine/AgentEngine.ts` | 新增 `loadSession()` 方法，支持会话恢复 |
| 不需要 | `ISessionContentStore` | Claude Code 的 `recordTranscript()` 已处理对话持久化，无需自建存储层 |
| 不需要 | `FileSessionContentStore` | 同上，不需要自建文件存储实现 |

**与旧方案对比**：

| 维度 | 旧方案（自建存储层） | 新方案（复用 Claude Code） |
|------|---------------------|--------------------------|
| 新增接口 | ISessionContentStore（9 个方法） | 无新接口 |
| 新增实现 | FileSessionContentStore | TranscriptParser + SessionStoragePath（两个工具函数） |
| 写入逻辑 | 框架拦截每条消息并写入 | Claude Code 自动写入，框架零干预 |
| 恢复逻辑 | 自定义格式读取 | 解析 Claude Code 原生 JSONL |
| 改动量 | 大（拦截 query 流程、管理文件目录） | 小（只加恢复读取逻辑） |
| 一致性风险 | 框架写入与 Claude Code 写入可能不一致 | 无风险，只有一个写入源 |

---

## 三、框架改动评估

### 3.1 需要新增的文件

| 文件 | 用途 |
|------|------|
| `engine/memory/IMemoryProvider.ts` | 记忆提供者接口 + MemoryEntry 类型 |
| `engine/memory/FileMemoryProvider.ts` | 文件系统默认实现（兼容 Claude Code memdir 格式） |
| `engine/session/TranscriptParser.ts` | JSONL 解析工具，将 Claude Code 的 transcript 文件转换为 Message[] |
| `engine/session/SessionStoragePath.ts` | workspace → 实际存储路径的映射工具函数 |

### 3.2 需要修改的文件

| 文件 | 改动 |
|------|------|
| `engine/AgentEngine.ts` | 添加 memory 配置项；新增 `loadSession()` 方法支持会话恢复 |
| `engine/bridge/OriginalQueryEngineBridge.ts` | 注入记忆到 systemPrompt；传递 workspace 参数到 QueryEngine |

### 3.3 对现有测试的影响

- 现有测试不受影响（新增扩展点和恢复逻辑都是可选的）
- 需要新增记忆系统测试（~20 个）
- 需要新增会话恢复测试（~15 个）：JSONL 解析、路径映射、恢复完整流程

### 3.4 风险评估

| 风险 | 影响 | 应对 |
|------|------|------|
| 记忆注入增加 token 消耗 | 成本增加 | 设置记忆总量上限（如 MAX_MEMORY_TOKENS） |
| Claude Code JSONL 格式变更 | 解析失败 | TranscriptParser 做版本兼容处理，解析失败时降级为空历史 |
| workspace sanitize 逻辑变更 | 路径定位失败 | SessionStoragePath 复用 Claude Code 原始函数，不自行实现 |
| JSONL 文件过大 | 恢复加载慢 | 支持尾部截取（只加载最近 N 轮对话） |
| 向后兼容 | 不使用 memory/loadSession 时行为不变 | 所有新增配置和方法都是可选的 |
