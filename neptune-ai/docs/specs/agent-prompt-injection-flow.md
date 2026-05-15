# Agent System Prompt 注入完整流程

> 基于代码和数据库实际状态编写，标注了「已实现」和「待实现」的区分。

## 当前事实状态

| 模块 | 代码状态 | 数据状态 |
|------|---------|---------|
| EnginePool（LRU 缓存） | ✅ 已实现 | ✅ 运行中 |
| Platform Guard（Block 1） | ✅ 已实现 | ✅ 硬编码常量 |
| Agent Identity（Block 2） | ✅ 已实现 | ✅ DB 有数据 |
| Agent Instructions / agent.md（Block 3） | ✅ 已实现 | ✅ 文件已创建 |
| Skills 注入（Block 4） | ✅ 代码已写 | ❌ agent_skills 表 0 条 |
| Knowledge 注入（Block 5） | ✅ 代码已写 | ❌ documents 表 0 条，无 knowledge/ 目录 |
| Tool Instructions（Block 6） | ✅ 代码已写 | ❌ 当前 Agent tools: [] |
| Provider 配置（GLM-5.1） | ✅ 已实现 | ✅ NEPTUNE_LLM_* 环境变量 |
| CLAUDE.md 屏蔽 | ✅ 已实现 | ✅ process.env 设置 |
| SDK 环境变量覆盖 | ✅ 已实现 | ✅ ANTHROPIC_* 被 NEPTUNE_LLM_* 覆盖 |

---

## 完整端到端流程

### 阶段 1: 创建 Agent（配置时）

```
用户在前端创建 Agent
    │
    ▼
POST /api/v1/agents
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  写入 DB: agentTemplates 表                              │
│                                                          │
│  当前实际数据（以 771633f8 为例）:                         │
│  ┌────────────────────────────────────────────────────┐  │
│  │ id: "771633f8-4dc7-4a03-bd6e-9d6f75dbd13c"        │  │
│  │ name: "Test Agent"                                 │  │
│  │ description: "A test agent"                        │  │
│  │ icon: "smart_toy"                                  │  │
│  │ systemPrompt: "你是 Neptune AI 平台的智能助手..."   │  │
│  │ promptConfig: {                                    │  │
│  │   identity: "你是 Neptune AI 平台的智能助手..."     │  │
│  │ }                                                  │  │
│  │ modelConfig: {                                     │  │
│  │   provider: "anthropic",                           │  │
│  │   model: "claude-3-5-sonnet-20241022",             │  │
│  │   temperature: 0.7,                                │  │
│  │   maxTokens: 4096                                  │  │
│  │ }                                                  │  │
│  │ tools: []              ← 当前无可用工具             │  │
│  │ skills: []             ← 当前无关联 Skill           │  │
│  │ mcpServers: []         ← 当前无 MCP 服务           │  │
│  │ constraints: {                                     │  │
│  │   maxTokensPerTurn: 10000,                         │  │
│  │   maxTurnsPerSession: 100,                         │  │
│  │   maxConcurrentSessions: 10                        │  │
│  │ }                                                  │  │
│  │ version: 1                                         │  │
│  │ isActive: true                                     │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  注意：                                                   │
│  - documents 表: 0 条（无 Agent 关联了文档）              │
│  - 文件系统 agent.md: 已创建（232 字符）                  │
└─────────────────────────────────────────────────────────┘
```

### 阶段 2: 用户发起对话（运行时入口）

```
用户选择 Agent → 发送消息 "你好"
    │
    ▼
POST /api/v1/agents/{agentId}/threads/{threadId}/chat
Body: { content: "你好" }
    │
    ▼
routes/threads.ts
    │ 验证 JWT → 提取 tenantId, userId
    │
    ▼
ThreadManager.dispatch(threadId, "你好")
```

### 阶段 3: dispatch 核心调度

```
ThreadManager.dispatch(threadId, content)
    │
    ├─── 1. 获取 Thread 记录
    │    SELECT * FROM sessions WHERE id = threadId
    │    → { tenantId, userId, templateId(=agentId), workspace, status }
    │
    ├─── 2. 获取 Agent 模板
    │    SELECT * FROM agent_templates WHERE id = agentId
    │    → { systemPrompt, promptConfig, tools, mcpServers }
    │
    ├─── 3. 检查 EnginePool 缓存                    【已实现，真实存在】
    │    pool.get(threadId)
    │    ├─ 命中 → 复用 Engine + sdkSessionId（跳到阶段 5）
    │    └─ 未命中 → 创建新 Engine（进入阶段 4）
    │
    │    EnginePool 行为：
    │    - 按 threadId 缓存 Engine 实例
    │    - LRU 淘汰策略（maxConcurrent 限制）
    │    - 同一 Thread 多次对话复用同一 Engine
    │    - Server 重启后 pool 清空，下次消息重建
    │
    ▼
```

### 阶段 4: 动态组装 System Prompt（仅在创建新 Engine 时）

```
assembleSystemPromptForAgent(template, agentId)
    │
    ├─── 4a. 并行查询 Skills 和 Documents
    │    ┌──────────────────────────────────────────────────┐
    │    │ fetchAgentSkills(agentId)                        │
    │    │   → SELECT FROM agent_skills JOIN skills         │
    │    │   → 当前结果: []（agent_skills 表为空）           │
    │    │                                                  │
    │    │ fetchAgentDocuments(agentId)                     │
    │    │   → SELECT FROM documents WHERE agentId = ...    │
    │    │   → 当前结果: []（documents 表为空）              │
    │    └──────────────────────────────────────────────────┘
    │
    ├─── 4b. 读取 agent.md                          【待实现】
    │    → 当前不存在此步骤
    │    → 计划: loadAgentInstructions(tenantId, agentId)
    │      读取 {dataRoot}/tenants/{tenantId}/agents/{agentId}/agent.md
    │
    ├─── 4c. 调用 PromptAssembler 组装
    │    assembleSystemPrompt({
    │      template: { systemPrompt, promptConfig },
    │      skills: [],           ← 当前为空
    │      documents: [],        ← 当前为空
    │      agentInstructions: "" ← 待实现
    │    })
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  PromptAssembler 组装逻辑（prompt-assembler.ts）             │
│                                                              │
│  if (!promptConfig) → 回退到 template.systemPrompt           │
│  if (promptConfig) → 按 Block 组装:                          │
│                                                              │
│  当前实际输出（基于真实数据）:                                 │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Block 1: Platform Guard              ← 硬编码，始终存在 │  │
│  │ "# Platform Security Guidelines..."                    │  │
│  │                                                        │  │
│  │ Block 2: Agent Identity              ← 来自 DB         │  │
│  │ "你是 Neptune AI 平台的智能助手..."                     │  │
│  │                                                        │  │
│  │ Block 3: Agent Instructions          ← 待实现          │  │
│  │ （当前不存在此 Block）                                  │  │
│  │                                                        │  │
│  │ Block 4: Skills                      ← 代码存在，数据空 │  │
│  │ （当前跳过，因为 skills=[]）                            │  │
│  │                                                        │  │
│  │ Block 5: Knowledge                   ← 代码存在，数据空 │  │
│  │ （当前跳过，因为 documents=[]）                         │  │
│  │                                                        │  │
│  │ Block 6: Tool Instructions           ← 未配置          │  │
│  │ （当前跳过，因为 toolInstructions 未设置）              │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  实际输出 = Block1 + Block2 = ~750 字符                      │
└─────────────────────────────────────────────────────────────┘
    │
    │  assembledSystemPrompt (string, ~750 chars)
    ▼
```

### 阶段 5: 创建 Engine 并执行 Query

```
engineFactory.createAndLoad({
  systemPrompt: assembledSystemPrompt,
  memoryRoot: "{dataRoot}/tenants/{tenantId}/agents/{agentId}",
  workspace: "{dataRoot}/tenants/{tenantId}/agents/{agentId}/threads/{threadId}/",
  tools: [],
  mcpServerUrls: [],
  tenantId: "..."
})
    │
    ▼
════════════════ 应用层 → 框架层 边界 ════════════════
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  框架层（neptune-engine SDK）                                │
│                                                              │
│  AgentEngine.create({                                        │
│    systemPrompt: "# Platform Security...\n\n你是 Neptune..." │
│    provider: {                                               │
│      type: 'anthropic',                                      │
│      config: {                                               │
│        apiKey: "325fce...klrv",          ← 智谱 API Key      │
│        baseURL: "https://open.bigmodel.cn/api/anthropic",    │
│        defaultModel: "glm-5.1",                              │
│      }                                                       │
│    },                                                        │
│    extensions: { permissions: { bypassPermissions: true } }  │
│  })                                                          │
│    │                                                         │
│    ▼                                                         │
│  engine.createSession({                                      │
│    workspace: thread.workspace,                              │
│    systemPrompt: assembledSystemPrompt,  ← per-session 存储  │
│  })                                                          │
│    → sessionPrompts.set(sessionId, systemPrompt)             │
│    → 返回 sdkSessionId                                      │
│    │                                                         │
│    ▼                                                         │
│  engine.query(sdkSessionId, "你好")                          │
│    │                                                         │
│    ├─ effectiveSystemPrompt = sessionPrompts.get(sessionId)  │
│    │  = 我们传入的 Guard + Identity 组合                     │
│    │                                                         │
│    ├─ QueryEngine 内部:                                      │
│    │  customSystemPrompt !== undefined → 跳过默认 CC prompt  │
│    │  → 不会出现 "You are Kiro..." 默认身份                  │
│    │                                                         │
│    ├─ AnthropicProvider:                                     │
│    │  applyConfig() → 临时设置 env vars                      │
│    │  model = "glm-5.1"                                      │
│    │  → HTTPS POST https://open.bigmodel.cn/api/anthropic    │
│    │                                                         │
│    └─ yield SSE events → 流式返回                            │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
SSE 响应 → 前端渲染
```

---

## 应用层 vs 框架层 职责边界

```
┌─────────────────────────────────────────────────────────────┐
│                    应用层（server/）                          │
│                                                              │
│  职责:                                                       │
│  1. Agent 配置存储（DB agentTemplates 表）                   │
│  2. System Prompt 动态组装（PromptAssembler 6 Block）        │
│  3. Skills/Documents/agent.md 数据读取                       │
│  4. Thread 生命周期管理                                      │
│  5. EnginePool 缓存管理                                      │
│  6. Provider 配置传递（NEPTUNE_LLM_* → SDK config）          │
│                                                              │
│  输出: 一个完整的 systemPrompt 字符串 + provider config      │
│                                                              │
│  不管:                                                       │
│  - LLM API 调用细节                                          │
│  - 对话历史管理（SDK 内部 transcript.jsonl）                  │
│  - 内存机制（SDK 内部 memoryRoot）                           │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ systemPrompt (string)
                           │ provider: { apiKey, baseURL, model }
                           │ workspace (string)
                           │ memoryRoot (string)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              框架层（neptune-engine SDK）                     │
│                                                              │
│  职责:                                                       │
│  1. 接收 customSystemPrompt → 替换默认 CC prompt             │
│  2. 管理对话历史（transcript.jsonl）                         │
│  3. Provider 适配（Anthropic 兼容接口调用）                   │
│  4. 流式响应生成                                             │
│  5. 内存机制（memoryRoot 下的 MEMORY.md）                    │
│                                                              │
│  不知道:                                                     │
│  - Agent 的存在                                              │
│  - Block 的存在                                              │
│  - agent.md 的存在                                           │
│  - Skills/Knowledge 的存在                                   │
│                                                              │
│  已屏蔽:                                                     │
│  - CLAUDE.md 加载（CLAUDE_CODE_DISABLE_CLAUDE_MDS=1）        │
└─────────────────────────────────────────────────────────────┘
```

---

## Engine 生命周期与 Prompt 更新时机

```
场景 1: 同一 Thread 多次对话
─────────────────────────────
消息 1 → pool 未命中 → 创建 Engine（读 DB + 读 agent.md）→ 缓存
消息 2 → pool 命中 → 复用 Engine（不重新组装 prompt）
消息 N → pool 命中 → 复用 Engine

结论: systemPrompt 在 Engine 创建时确定，Thread 生命周期内不变


场景 2: 用户切换 Agent
─────────────────────────────
Agent A 的 Thread → pool 有 Engine A
用户切换到 Agent B → 创建新 Thread → pool 未命中 → 创建 Engine B（读 B 的配置）

结论: 切换 Agent = 新 Thread = 新 Engine = 新 systemPrompt


场景 3: agent.md 被修改
─────────────────────────────
已有 Thread 的 Engine → 不受影响（pool 缓存中）
新 Thread → 创建 Engine 时读到新 agent.md

结论: 修改 agent.md 对已有对话无影响，新对话生效


场景 4: Server 重启
─────────────────────────────
pool 清空 → 所有 Thread 下次消息时重建 Engine → 重新读取最新配置

结论: 重启后所有配置变更生效
```

---

## 已实现: agent.md 注入（Block 3）

### 存储路径

```
{dataRoot}/tenants/{tenantId}/agents/{agentId}/agent.md
```

实际路径示例:
```
server/data/tenants/71a24ee8-.../agents/771633f8-.../agent.md
```

### 读取逻辑（在 ThreadManager 中）

```typescript
private loadAgentInstructions(tenantId: string, agentId: string): string {
  const filePath = resolve(this.dataRoot, 'tenants', tenantId, 'agents', agentId, 'agent.md');
  if (!existsSync(filePath)) return '';
  try {
    const content = readFileSync(filePath, 'utf-8');
    const maxChars = 20000; // ~5000 tokens
    if (content.length > maxChars) {
      return content.slice(0, maxChars) + '\n\n... [instructions truncated]';
    }
    return content;
  } catch {
    return '';
  }
}
```

### 组装后的完整 Block 顺序

```
Block 1: Platform Guard        — 硬编码安全规则（始终存在）
Block 2: Agent Identity        — 短文本身份（来自 DB promptConfig.identity）
Block 3: Agent Instructions    — 行为指令（来自文件系统 agent.md）← 待实现
Block 4: Skills                — 技能模块（来自 DB agent_skills 表）← 有代码无数据
Block 5: Knowledge             — 知识库文档（来自 DB documents 表）← 有代码无数据
Block 6: Tool Instructions     — 工具约束（来自 DB promptConfig.toolInstructions）← 未配置
```

### 各 Block 数据来源对照

| Block | 数据来源 | 存储位置 | 当前状态 |
|-------|---------|---------|---------|
| Guard | 硬编码 | prompt-assembler.ts 常量 | ✅ 工作中 |
| Identity | promptConfig.identity | DB agentTemplates 表 | ✅ 工作中 |
| Instructions | agent.md 文件 | 文件系统 | ❌ 待实现 |
| Skills | agent_skills 关联 | DB agent_skills + skills 表 | ⚠️ 代码就绪，无数据 |
| Knowledge | documents 关联 | DB documents 表 + 文件系统 | ⚠️ 代码就绪，无数据 |
| Tool Instructions | promptConfig.toolInstructions | DB agentTemplates 表 | ⚠️ 代码就绪，未配置 |
