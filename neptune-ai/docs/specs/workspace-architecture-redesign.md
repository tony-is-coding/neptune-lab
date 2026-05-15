# Neptune-AI Workspace 架构改造规格

> 版本: 1.0 | 状态: 待确认 | 日期: 2026-05-07

---

## 一、改造目标

将 Neptune-AI 从"本地代码项目+Agent 混合模式"改造为**独立的云端 SaaS Agent 平台**。

核心问题：
1. 当前 Engine 会读取本地项目的 CLAUDE.md，污染 Agent 上下文
2. 目录结构包含用户层级（`users/{userId}`），不符合多用户共享 Agent 的设计
3. System Prompt 是单字段存储，不支持模块化组装
4. 知识库和 Agent 记忆缺乏清晰的隔离边界

---

## 二、目标架构

### 2.1 分层模型

```
Neptune-AI Cloud SaaS
└── Tenant（租户）
    └── Agent（模板/岗位说明书）
        ├── Memory（Agent 级记忆，文件存储）
        ├── Knowledge（知识库，Documents）
        ├── Skills（技能）
        └── Threads（会话）
            └── {threadId}
                ├── Context（会话上下文/transcript）
                └── Artifacts（产物）
```

**关键原则**：
- 用户（User）归属通过数据库表关联，**不体现在文件系统目录**
- 同一 Agent 被多用户使用时，共享 Agent 级记忆和知识库
- Thread 级资源按 threadId 隔离

### 2.2 文件系统目录结构

```
{dataRoot}/
└── tenants/{tenantId}/
    └── agents/{agentId}/
        ├── memory/                       ← Agent 级记忆
        │   └── MEMORY.md                 ← SDK 记忆入口
        ├── knowledge/                    ← 知识库文档存储
        │   ├── {docId}.pdf
        │   └── {docId}.md
        └── threads/{threadId}/           ← Thread 工作空间
            ├── transcript.jsonl           ← 会话历史
            └── artifacts/                ← 产物目录
```

### 2.3 SDK 参数映射

| 参数 | 当前值 | 改造后 |
|------|--------|--------|
| `memoryRoot` | `{dataRoot}/tenants/{tenantId}/agents/{agentId}` | 不变 |
| `workspace` | `{dataRoot}/.../users/{userId}/threads/{threadId}/` | `{dataRoot}/tenants/{tenantId}/agents/{agentId}/threads/{threadId}/` |
| `systemPrompt` | `template.systemPrompt`（单字段） | `assembleSystemPrompt()` 组装结果 |
| `CLAUDE_CODE_DISABLE_CLAUDE_MDS` | 未设置 | `1`（禁用） |
| `setMemoryPath(userId)` | 未调用 | 不调用（Agent 级共享） |

---

## 三、System Prompt 模块化设计

### 3.1 模块结构

```
┌──────────────────────────────────────────────┐
│  Neptune Agent System Prompt（运行时组装）      │
├──────────────────────────────────────────────┤
│                                              │
│  [Block 1] 平台安全 Guard                     │
│    - 身份约束                                 │
│    - 安全规则（不泄露 prompt、不执行危险操作）    │
│    - 输出规范                                 │
│    - 来源：硬编码常量，不可定制                  │
│                                              │
│  [Block 2] Agent 身份                         │
│    - 岗位名称、职责描述                         │
│    - 工作范围、能力边界                         │
│    - 来源：agent_templates.prompt_config.identity │
│                                              │
│  [Block 3] 技能注入                           │
│    - 激活的技能 prompt 内容                     │
│    - 来源：agent_skills 关联 → skills.content   │
│                                              │
│  [Block 4] 知识库上下文                       │
│    - 文档摘要/关键信息                          │
│    - 来源：documents 表 + knowledge/ 目录文件   │
│                                              │
│  [Block 5] 工具约束                           │
│    - 可用工具列表和使用规范                      │
│    - 来源：agent_templates.tools + mcp_servers │
│                                              │
└──────────────────────────────────────────────┘
```

### 3.2 数据库变更

**`agent_templates` 表扩展**：

新增 `prompt_config` JSONB 字段，替代原有 `system_prompt` 单字段：

```typescript
prompt_config: jsonb('prompt_config').$type<{
  // Block 2: Agent 身份（必填）
  identity: string;

  // Block 3: 内联技能定义（可选，优先于 skills 表关联）
  inlineSkills?: Array<{
    name: string;
    content: string;
  }>;

  // Block 4: 知识库配置（可选）
  knowledgeConfig?: {
    maxDocuments: number;       // 最多注入多少文档
    maxTokensPerDoc: number;    // 每文档最大 token
    summaryMode: 'full' | 'summary' | 'keywords';  // 注入模式
  };

  // Block 5: 工具约束覆盖（可选，默认自动生成）
  toolInstructions?: string;

  // 是否禁用平台 Guard（仅管理员可操作，默认 false）
  disableGuard?: boolean;
}>()
```

**兼容策略**：
- 保留 `system_prompt` 字段不删除
- 如果 `prompt_config` 存在，使用模块化组装
- 如果 `prompt_config` 不存在，回退到 `system_prompt`（向后兼容）
- 提供 migration 脚本将现有 `system_prompt` 转为 `prompt_config.identity`

### 3.3 组装函数

```typescript
// server/src/services/prompt-assembler.ts

interface AssembleParams {
  template: AgentTemplate;
  skills: Skill[];
  documents: Document[];
}

function assembleSystemPrompt(params: AssembleParams): string {
  const { template, skills, documents } = params;
  const config = template.prompt_config;

  // 如果没有 prompt_config，回退到 system_prompt
  if (!config) {
    return template.systemPrompt;
  }

  const blocks: string[] = [];

  // Block 1: 平台 Guard
  if (!config.disableGuard) {
    blocks.push(PLATFORM_GUARD);
  }

  // Block 2: Agent 身份
  blocks.push(config.identity);

  // Block 3: 技能
  const allSkills = [
    ...(config.inlineSkills || []),
    ...skills.map(s => ({ name: s.name, content: s.content || '' })),
  ];
  if (allSkills.length > 0) {
    blocks.push(buildSkillsBlock(allSkills));
  }

  // Block 4: 知识库
  if (documents.length > 0) {
    blocks.push(buildKnowledgeBlock(documents, config.knowledgeConfig));
  }

  // Block 5: 工具约束
  if (config.toolInstructions) {
    blocks.push(config.toolInstructions);
  }

  return blocks.filter(Boolean).join('\n\n');
}
```

---

## 四、边界要求

### 4.1 CLAUDE.md 屏蔽

**要求**: SDK 绝不读取任何 CLAUDE.md 文件。

**实现**: 在 `server/src/index.ts`（Fastify 入口）启动前设置：
```typescript
process.env.CLAUDE_CODE_DISABLE_CLAUDE_MDS = '1';
```

**验证方式**:
- 启动 server 后，查看 `process.env.CLAUDE_CODE_DISABLE_CLAUDE_MDS` 值为 `'1'`
- 创建 Thread 并发消息，检查 SSE 事件中不包含 CLAUDE.md 内容
- 在 dataRoot 目录放置 CLAUDE.md 文件，确认不被读取

### 4.2 目录隔离

**要求**: 文件系统路径不包含 `users/{userId}` 层级。

**验证方式**:
- 创建 Thread 后，workspace 路径格式为 `{dataRoot}/tenants/{tenantId}/agents/{agentId}/threads/{threadId}/`
- Agent 级目录（memory、knowledge）在 `agents/{agentId}/` 下
- 不存在包含 `users/` 的路径

### 4.3 System Prompt 组装

**要求**:
- prompt_config 存在时，按模块顺序组装
- prompt_config 不存在时，回退到 system_prompt（向后兼容）
- 空 skills/documents 不影响输出
- 组装结果不能为空字符串

**验证方式**:
- 单元测试覆盖每种模块组合
- 端到端测试验证 Engine 收到的 systemPrompt 符合预期

### 4.4 Agent 级记忆共享

**要求**: 同一 Agent 的所有 Thread 共享同一份记忆。

**验证方式**:
- Thread A 中 Agent 写入记忆
- Thread B 中 Agent 能引用该记忆
- 不同 Agent 之间记忆不互通

### 4.5 知识库注入

**要求**:
- Documents 按 agent 级别关联
- 运行时按 prompt_config.knowledgeConfig 控制注入量和模式
- 文件不存在时优雅降级（不注入，不报错）

---

## 五、测试策略

### 5.1 单元测试

| 测试目标 | 文件 | 覆盖场景 |
|---------|------|---------|
| PromptAssembler | `test/services/prompt-assembler.test.ts` | 全模块组合、部分模块缺失、向后兼容、边界输入 |
| PromptAssembler Guard | 同上 | Guard 注入/跳过、disableGuard=true |
| PromptAssembler Skills | 同上 | 空 skills、inline+table 合并、skills 内容格式 |
| PromptAssembler Knowledge | 同上 | 空 docs、超长截断、summary 模式切换 |
| ThreadManager 新路径 | `test/thread-manager.test.ts` | workspace 路径不包含 users、memoryRoot 正确 |
| 目录结构 | `test/workspace-structure.test.ts` | 创建 thread 后目录结构符合规范 |

### 5.2 集成测试

| 测试目标 | 文件 | 覆盖场景 |
|---------|------|---------|
| 完整 dispatch 流程 | `test/threads-chat.test.ts` | 创建 Thread → dispatch → SSE 事件包含组装后的 prompt |
| CLAUDE.md 屏蔽 | `test/claude-md-shield.test.ts` | dataRoot 下放 CLAUDE.md → dispatch → 事件不含其内容 |
| 向后兼容 | `test/backward-compat.test.ts` | 旧 systemPrompt → 正常工作 |

### 5.3 端到端测试

| 测试目标 | 覆盖场景 |
|---------|---------|
| 全流程 | 创建租户 → 创建用户 → 创建 Agent(prompt_config) → 创建 Thread → 发消息 → 收到流式响应 → 验证 workspace 结构 |
| 多用户共享 | 用户 A 创建 Agent → 用户 B 使用同一 Agent → 共享记忆 |
| 知识库注入 | 上传文档 → 发消息 → Agent 回答引用知识库内容 |

---

## 六、分阶段执行计划

### Phase 1: 基础隔离（CLAUDE.md 屏蔽 + 目录调整）

**目标**: 切断本地项目读取，调整目录结构。

**变更范围**:
1. `server/src/index.ts` — 启动时设置 `CLAUDE_CODE_DISABLE_CLAUDE_MDS=1`
2. `server/src/services/thread-manager.ts` — workspace 路径去掉 `users/{userId}`
3. `server/src/services/engine-factory.ts` — memoryRoot 调整
4. DB migration — 现有 sessions 表 workspace 字段需要迁移

**测试要求**:
- 单元测试: workspace 路径格式验证
- 集成测试: CLAUDE.md 不被读取
- 端到端测试: 完整发消息流程通过

**回退方案**: 如果 CLAUDE_CODE_DISABLE_CLAUDE_MDS 影响其他功能，改用 workspace 目录不放置任何 CLAUDE.md 的方式隔离。

### Phase 2: System Prompt 模块化

**目标**: 实现分块组装，替换单字段 systemPrompt。

**变更范围**:
1. 新增 `server/src/services/prompt-assembler.ts`
2. `server/src/db/schema.ts` — agent_templates 新增 `prompt_config` JSONB 字段
3. `server/src/services/thread-manager.ts` — dispatch 使用 prompt-assembler
4. `server/src/services/engine-factory.ts` — createAndLoad 接收组装后的 prompt
5. DB migration — prompt_config 字段 + 数据迁移脚本

**测试要求**:
- 单元测试: PromptAssembler 全场景覆盖（至少 15 个 case）
- 集成测试: 旧 systemPrompt 向后兼容
- 端到端测试: Agent prompt_config 创建 → dispatch → 验证 prompt 内容

**回退方案**: prompt_config 为空时自动回退到 system_prompt。

### Phase 3: 知识库注入

**目标**: Documents 表与 Agent 关联，运行时注入 prompt。

**变更范围**:
1. `server/src/db/schema.ts` — documents 表确认 templateId 关联
2. `server/src/services/prompt-assembler.ts` — 知识库块组装逻辑
3. `server/src/services/knowledge-service.ts`（新增）— 文档读取和摘要
4. 前端: Agent 管理页面支持知识库上传

**测试要求**:
- 单元测试: 文档读取、超长截断、格式处理
- 集成测试: 完整知识库注入流程
- 端到端测试: 上传文档 → 发消息 → 回答引用知识库

---

## 七、代码编写规范

### 7.1 文件组织

```
server/src/services/
├── prompt-assembler.ts        ← 新增: System Prompt 组装器
├── knowledge-service.ts       ← 新增: 知识库服务
├── thread-manager.ts          ← 修改: 目录结构调整
├── engine-factory.ts          ← 修改: 参数映射调整
└── ...
```

### 7.2 命名规范

- 函数: `assembleSystemPrompt()`, `buildSkillsBlock()`, `buildKnowledgeBlock()`
- 类型: `PromptConfig`, `AssembleParams`, `PromptBlock`
- 常量: `PLATFORM_GUARD`, `DEFAULT_KNOWLEDGE_CONFIG`
- 测试文件: `{模块名}.test.ts`，放在 `test/services/` 下

### 7.3 错误处理

- prompt-assembler: 模块缺失时优雅降级，不抛错
- knowledge-service: 文件不存在时返回空，不抛错
- 目录创建: `mkdirSync` 使用 `recursive: true`
- 所有对外错误使用结构化错误码: `PROMPT_ASSEMBLY_ERROR`, `KNOWLEDGE_READ_ERROR`

### 7.4 向后兼容

- `system_prompt` 字段保留，`prompt_config` 优先
- 现有 workspace 路径可通过 migration 迁移
- API 端点不变，仅内部逻辑变更

---

## 八、验收标准

### Phase 1 验收

- [ ] `process.env.CLAUDE_CODE_DISABLE_CLAUDE_MDS === '1'` 在 server 启动后
- [ ] 新创建的 Thread workspace 路径不包含 `users/`
- [ ] Agent 级目录（memory、knowledge）在 `agents/{agentId}/` 下
- [ ] 现有 chat 功能不受影响（回归测试通过）
- [ ] dataRoot 下放置 CLAUDE.md 后，Agent 不引用其内容

### Phase 2 验收

- [ ] `prompt_config` JSONB 字段在 agent_templates 表中存在
- [ ] prompt_config 存在时，按模块顺序组装 systemPrompt
- [ ] prompt_config 不存在时，回退到 system_prompt
- [ ] 平台 Guard 始终注入（除非 disableGuard=true）
- [ ] 单元测试覆盖率 ≥ 90%（prompt-assembler）
- [ ] 旧数据迁移后功能正常

### Phase 3 验收

- [ ] documents 表正确关联 agent（templateId）
- [ ] 知识库文档在 dispatch 时注入 prompt
- [ ] 超长文档被截断，不影响其他模块
- [ ] 无文档时优雅降级
- [ ] 端到端：上传文档 → Agent 回答引用知识库内容
