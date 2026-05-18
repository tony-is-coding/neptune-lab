> **文档状态**：✅ 最新（CC 原始能力分析文档）| 更新时间：2026-04-22

# Query Engine 设计文档

> **说明**：本文档是对 Claude Code 原始 QueryEngine（`src/QueryEngine.ts` + `src/query.ts`）的分析文档。
> 我们**直接使用**原始 QueryEngine，不自建替代。AgentEngine 通过桥接层调用原始 QueryEngine.submitMessage()。
> 详见 [架构设计 — 包装不替代原则](../../architecture.md)。

---

## 一、功能概述

### 1.1 功能目标
Query Engine 是 Claude Code 的核心执行引擎，负责管理与 LLM 的交互循环、工具调用、上下文管理、成本追踪和错误恢复。它是整个 Agent 生命周期的编排器。

### 1.2 解决的问题
- **LLM 交互循环**：管理与 LLM 的多轮对话，处理工具调用和响应
- **上下文管理**：自动压缩上下文，控制 Token 预算，避免超出限制
- **工具执行**：调用工具、处理结果、错误恢复
- **成本控制**：追踪 Token 使用和成本，支持预算限制
- **流式处理**：高效处理 LLM 流式响应，避免性能瓶颈

### 1.3 适用场景
- 需要与 LLM 进行多轮交互的场景
- 需要调用工具完成复杂任务的场景
- 需要控制成本和 Token 使用的场景
- 需要处理长对话和上下文压缩的场景

---

## 二、设计目标

### 2.1 功能性目标
- 支持 while(true) 循环，直到任务完成
- 支持工具调用和并行工具执行
- 支持自动上下文压缩和 Token 控制
- 支持成本追踪和预算限制
- 支持错误恢复和重试机制

### 2.2 非功能性目标
- **性能**：流式处理避免 O(n²) 复杂度
- **可靠性**：完善的错误恢复机制
- **可观测性**：完整的成本和性能追踪
- **可扩展性**：通过 Provider 支持多种 LLM

### 2.3 约束条件
- 依赖 LLM Provider 进行模型调用
- 依赖 Tool Provider 进行工具执行
- 依赖 Context Provider 进行上下文管理

---

## 三、技术方案

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                     Query Engine                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  会话级 (QueryEngine)                                  │  │
│  │  - 会话状态管理                                        │  │
│  │  - 消息历史维护                                        │  │
│  │  - 累计成本追踪                                        │  │
│  │  - 文件缓存管理                                        │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ↓                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  回合级 (query)                                        │  │
│  │  - while(true) 执行循环                               │  │
│  │  - 工具调用解析                                        │  │
│  │  - 上下文压缩流水线                                    │  │
│  │  - 预算强制执行                                        │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ↓                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  ToolExecutor (工具执行层)                            │  │
│  │  - 工具类型识别和分发                                  │  │
│  │  - Hook 拦截点管理                                     │  │
│  │  - 权限检查流水线                                      │  │
│  │  - 执行器调度                                          │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ↓                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  具体执行器                                            │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐              │  │
│  │  │  Bash    │ │  File    │ │  Agent   │              │  │
│  │  │ Executor │ │ Executor │ │ Executor │              │  │
│  │  └──────────┘ └──────────┘ └──────────┘              │  │
│  │  ┌──────────┐ ┌──────────┐                            │  │
│  │  │   MCP    │ │  Skill   │                            │  │
│  │  │ Executor │ │ Executor │                            │  │
│  │  └──────────┘ └──────────┘                            │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                    Provider 层                               │
│  LLM Provider / Tool Provider / Context Provider            │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 核心流程

#### 3.2.1 两层架构

```
QueryEngine (会话级)
  ├── 生命周期：整个会话
  ├── 职责：
  │   ├── 会话状态管理
  │   ├── 消息历史维护
  │   ├── 累计成本追踪
  │   └── 文件缓存管理
  └── API: submitMessage()

query() (回合级)
  ├── 生命周期：每个用户消息
  ├── 职责：
  │   ├── API 循环
  │   ├── 工具调用解析
  │   ├── 自动压缩
  │   └── 预算强制执行
  └── 返回：AsyncGenerator

ToolExecutor (工具执行层)
  ├── 生命周期：每个工具调用
  ├── 职责：
  │   ├── 工具类型识别和分发
  │   ├── Hook 拦截点管理
  │   ├── 权限检查流水线
  │   └── 执行器调度
  └── 返回：AsyncGenerator
```

#### 3.2.2 submitMessage 生命周期

```
submitMessage(userInput)
    ↓
第一阶段：输入处理
  processUserInput()
    ├── 处理斜杠命令 (/compact, /clear, /model)
    ├── 处理文件附件 (图片、文档)
    ├── 输入规范化
    └── 工具白名单
    ↓
第二阶段：上下文组装
  assembleContext()
    ├── CLAUDE.md
    ├── 当前目录信息
    ├── 已安装技能
    └── 插件提供的上下文
    ↓
第三阶段：query() 循环
  while(true) {
    1. 预处理：压缩流水线
    2. 调用 API：流式获取响应
    3. 后处理：通过 ToolExecutor 执行工具，处理错误
    4. 决策：继续 (tool_use) 或 终止 (end_turn)
  }
    ↓
返回结果
```

#### 3.2.3 query() 循环详解

```
while (true) {
  // 1. 预处理：压缩流水线
  messages = applyCompressionPipeline(messages)
    ├── 工具结果预算：限制工具输出大小
    ├── Snip：移除陈旧的对话片段
    ├── Microcompact：缓存感知的文件编辑记录
    ├── Context Collapse：归档旧的回合
    └── Autocompact：接近 Token 限制时全文摘要
  
  // 2. 调用 API：流式获取响应
  stream = await llmProvider.streamMessage(messages)
  for await (const event of stream) {
    yield event  // 流式返回给用户
  }
  
  // 3. 后处理：通过 ToolExecutor 执行工具
  if (hasToolUse(response)) {
    toolResults = await toolExecutor.executeTools(toolUses)
    messages.push(toolResults)
    continue  // 继续循环
  }
  
  // 4. 决策：终止
  if (isEndTurn(response)) {
    break  // 退出循环
  }
}
```

#### 3.2.4 压缩流水线

```
原始消息
    ↓
工具结果预算
  - 限制单个工具输出大小
  - 截断过长的工具结果
    ↓
Snip (剪裁)
  - 移除陈旧的对话片段
  - 保留最近的 N 轮对话
    ↓
Microcompact (微压缩)
  - 缓存感知的文件编辑记录
  - 合并连续的文件编辑
    ↓
Context Collapse (上下文折叠)
  - 归档旧的回合
  - 生成摘要替换原始内容
    ↓
Autocompact (自动压缩)
  - 接近 Token 限制时触发
  - 全文摘要压缩
    ↓
压缩后的消息
```

#### 3.2.5 ToolExecutor 执行流程

ToolExecutor 是 QueryEngine 的工具执行层，负责接收 ToolDefinition，根据工具类型分发执行，并管理 Hook 拦截点。

**核心职责**：
- 工具类型识别和分发
- Hook 拦截点管理（PreToolUse / PostToolUse）
- 权限检查流水线
- 执行器调度
- 结果处理和错误恢复

**执行流程图**：

```
LLM 返回 tool_use block
    ↓
query() 检测到工具调用
    ↓
ToolExecutor.executeTools(toolUses)
    ↓
分区工具调用 (partitionToolCalls)
  ├─ isConcurrencySafe = true → 并发执行
  └─ isConcurrencySafe = false → 串行执行
    ↓
ToolExecutor.executeToolUse(toolUse)
    ↓
┌─────────────────────────────────────────────┐
│  1. 工具查找                                 │
│     - 从 Tool Provider 获取 ToolDefinition   │
│     - 验证工具存在                           │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│  2. 输入验证                                 │
│     - Zod schema 验证                        │
│     - 工具特定验证 (validateInput)           │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│  3. PreToolUse Hook 拦截                     │
│     - 执行 PreToolUse hooks                  │
│     - 可以修改输入                           │
│     - 可以拒绝执行                           │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│  4. 权限检查                                 │
│     - 调用 canUseTool()                      │
│     - 决策：allow / deny / ask               │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│  5. 执行器分发                               │
│     - 根据工具类型选择执行器                 │
│     - BashExecutor / FileExecutor / ...      │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│  6. 工具执行                                 │
│     - 执行器调用具体实现                     │
│     - 流式返回进度                           │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│  7. PostToolUse Hook 拦截                    │
│     - 执行 PostToolUse hooks                 │
│     - 可以修改输出                           │
│     - 可以注入上下文                         │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│  8. 结果处理                                 │
│     - 大结果持久化                           │
│     - 上下文修改应用                         │
│     - 遥测记录                               │
└─────────────────────────────────────────────┘
    ↓
返回 tool_result 给 query()
```

**执行器分类**：

| 执行器类型 | 职责 | 示例工具 |
|-----------|------|---------|
| **BashExecutor** | 执行 Shell 命令 | Bash |
| **FileExecutor** | 文件读写操作 | Read, Write, Edit |
| **AgentExecutor** | 子代理调用 | Agent, Skill |
| **MCPExecutor** | MCP 工具调用 | mcp__* |
| **WebExecutor** | Web 操作 | WebFetch, WebSearch |
| **NotebookExecutor** | Jupyter 操作 | NotebookEdit |

**与 QueryEngine 的集成**：

```typescript
class QueryEngine {
  private toolExecutor: ToolExecutor
  
  constructor(options: QueryEngineOptions) {
    this.toolExecutor = new ToolExecutor({
      toolProvider: options.toolProvider,
      hookManager: options.hookManager,
      permissionChecker: options.permissionChecker,
    })
  }
  
  async *query(messages: Message[]): AsyncGenerator<Event> {
    // ... LLM 调用 ...
    
    if (hasToolUse(response)) {
      // 通过 ToolExecutor 执行工具
      const toolResults = await this.toolExecutor.executeTools(toolUses)
      messages.push(toolResults)
    }
  }
}
```

**Tool Provider 的职责**：

Tool Provider 只提供 ToolDefinition（数据定义），不包含执行逻辑：

```typescript
interface ToolDefinition {
  name: string
  description: string
  inputSchema: ZodSchema
  metadata: {
    type: 'bash' | 'file' | 'agent' | 'mcp' | 'web' | 'notebook'
    isConcurrencySafe: boolean
    requiresPermission: boolean
  }
}

interface ToolProvider {
  // 获取所有可用工具的定义
  getToolDefinitions(): ToolDefinition[]
  
  // 根据名称查找工具定义
  findToolByName(name: string): ToolDefinition | null
  
  // 验证工具输入（可选的工具特定验证）
  validateInput?(toolName: string, input: any): ValidationResult
}
```

ToolExecutor 根据 ToolDefinition 的 metadata.type 分发到对应的执行器。

#### 3.2.6 错误恢复流程

```
API 调用 → 出错?
  ├── 429 (限流)      → 指数退避重试（基数 500ms，上限 32s）
  ├── 529 (过载)      → 前台查询重试；后台查询立即放弃
  ├── 401 (认证失败)  → 刷新 OAuth Token，清除 API 密钥缓存，重试
  ├── 403 (Token 撤销) → 强制 Token 刷新，重试
  ├── ECONNRESET/EPIPE → 禁用长连接，重新建连
  ├── 上下文溢出        → 计算安全 max_tokens，重试
  └── 其他 5xx         → 标准指数退避重试

连续 3 次 529 错误 → 模型降级
  ├── 生成墓碑标记
  ├── 剥离 Thinking 签名
  └── 用备用模型重试

输出 Token 上限 → 三级升级策略
  ├── 1. 升级到 64K Token
  ├── 2. 注入恢复消息（最多 3 次）
  └── 3. 恢复耗尽 → 暴露错误给用户
```

### 3.3 数据结构

#### 3.3.1 QueryEngine

```typescript
class QueryEngine {
  sessionId: string
  messages: Message[]              // 消息历史
  totalCost: number                // 累计成本
  totalTokens: number              // 累计 Token
  modelUsage: Map<string, Usage>   // 按模型统计
  fileCache: Map<string, string>   // 文件缓存
  executionContext: ExecutionContext
  toolExecutor: ToolExecutor       // 工具执行器
  
  submitMessage(input: string): AsyncGenerator<Event>
}
```

#### 3.3.2 Message

```typescript
interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string | ContentBlock[]
  uuid?: string
  parentUuid?: string
  metadata?: Record<string, any>
}

interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result' | 'thinking'
  text?: string
  id?: string
  name?: string
  input?: any
  content?: any
}
```

#### 3.3.3 ToolExecutor

```typescript
class ToolExecutor {
  private toolProvider: ToolProvider
  private hookManager: HookManager
  private permissionChecker: PermissionChecker
  private executors: Map<string, Executor>
  
  // 执行多个工具（支持并发和串行）
  executeTools(toolUses: ToolUse[]): AsyncGenerator<ToolResult>
  
  // 执行单个工具
  executeToolUse(toolUse: ToolUse): AsyncGenerator<ToolResult>
}

interface ToolUse {
  id: string
  name: string
  input: any
}

interface ToolResult {
  toolUseId: string
  content: string | ContentBlock[]
  isError: boolean
}

interface Executor {
  // 执行工具
  execute(toolDef: ToolDefinition, input: any): AsyncGenerator<ExecutionEvent>
  
  // 验证输入
  validateInput(toolDef: ToolDefinition, input: any): ValidationResult
}
```

#### 3.3.4 ToolDefinition

```typescript
interface ToolDefinition {
  name: string
  description: string
  inputSchema: ZodSchema
  metadata: ToolMetadata
}

interface ToolMetadata {
  type: 'bash' | 'file' | 'agent' | 'mcp' | 'web' | 'notebook'
  isConcurrencySafe: boolean
  requiresPermission: boolean
  category?: string
}
```

#### 3.3.5 CompressionConfig

```typescript
interface CompressionConfig {
  toolResultBudget: number         // 工具结果预算（字符数）
  snipThreshold: number            // Snip 触发阈值（轮数）
  microcompactEnabled: boolean     // 是否启用微压缩
  contextCollapseThreshold: number // 上下文折叠阈值（轮数）
  autocompactThreshold: number     // 自动压缩阈值（Token 数）
}
```

---

## 四、接口设计

### 4.1 核心 API

```typescript
class QueryEngine {
  // 提交用户消息
  submitMessage(input: string | ContentBlock[]): AsyncGenerator<Event>
  
  // 获取消息历史
  getMessages(): Message[]
  
  // 获取成本统计
  getCostStats(): CostStats
  
  // 清空历史
  clear(): void
  
  // 压缩历史
  compact(): Promise<void>
}
```

### 4.2 事件类型

```typescript
type Event = 
  | { type: 'message_start', message: Message }
  | { type: 'content_block_start', index: number, block: ContentBlock }
  | { type: 'content_block_delta', index: number, delta: string }
  | { type: 'content_block_stop', index: number }
  | { type: 'message_stop', usage: Usage }
  | { type: 'tool_use', toolUse: ToolUse }
  | { type: 'tool_result', toolResult: ToolResult }
  | { type: 'error', error: Error }
```

### 4.3 参数说明

**submitMessage**
- `input`: 用户输入，可以是字符串或 ContentBlock 数组
- 返回：AsyncGenerator，持续产出事件
- 行为：执行完整的 query() 循环，直到任务完成

**compact**
- 行为：手动触发上下文压缩
- 使用场景：用户主动压缩历史，释放 Token

### 4.4 错误处理

```typescript
enum QueryEngineErrorCode {
  API_ERROR = 'API_ERROR',
  TOOL_EXECUTION_ERROR = 'TOOL_EXECUTION_ERROR',
  CONTEXT_OVERFLOW = 'CONTEXT_OVERFLOW',
  BUDGET_EXCEEDED = 'BUDGET_EXCEEDED',
  COMPRESSION_ERROR = 'COMPRESSION_ERROR',
}
```

---

## 五、实现计划

### 5.1 实现步骤

**阶段 1：基础循环**
1. 创建 QueryEngine 类骨架
2. 实现基础 submitMessage 和 query() 循环
3. 集成 LLM Provider
4. 编写基础测试

**阶段 2：工具执行**
1. 创建 ToolExecutor 类骨架
2. 实现工具调用解析
3. 集成 Tool Provider（获取 ToolDefinition）
4. 实现执行器分发逻辑
5. 实现各类执行器（BashExecutor、FileExecutor、AgentExecutor 等）
6. 集成 Hook 系统（PreToolUse / PostToolUse）
7. 实现工具结果处理
8. 编写工具执行测试

**阶段 3：上下文管理**
1. 实现压缩流水线
2. 实现 Snip / Microcompact / Context Collapse
3. 实现 Autocompact
4. 编写压缩测试

**阶段 4：错误恢复和优化**
1. 实现 withRetry 机制
2. 实现模型降级
3. 实现成本追踪
4. 编写错误恢复测试

### 5.2 依赖关系

```
QueryEngine
  ├── 依赖 LLM Provider（阶段 1）
  ├── 依赖 Tool Provider（阶段 2）
  ├── 依赖 Context Provider（阶段 3）
  └── 依赖 EventBus（阶段 1-4）
```

### 5.3 里程碑

- **M1**：基础循环（submitMessage, query, 流式处理）
- **M2**：工具执行（tool_use, tool_result, 并行执行）
- **M3**：上下文管理（压缩流水线、Token 控制）
- **M4**：生产就绪（错误恢复、成本追踪、监控）

---

## 六、测试计划

### 6.1 测试策略

- **单元测试**：测试每个方法的基本功能
- **集成测试**：测试与 LLM Provider、Tool Provider 的集成
- **端到端测试**：测试完整的对话流程
- **性能测试**：测试流式处理性能和压缩效率

### 6.2 测试用例

**基础循环测试**
- 单轮对话
- 多轮对话
- 流式响应处理
- 循环终止条件

**工具执行测试**
- 单个工具调用
- 多个工具并行调用
- 工具执行失败
- 工具结果处理

**上下文管理测试**
- Snip 触发和执行
- Microcompact 合并编辑
- Context Collapse 归档
- Autocompact 全文压缩
- Token 预算控制

**错误恢复测试**
- 429 限流重试
- 529 过载降级
- 401 认证刷新
- 上下文溢出处理
- 输出上限升级

### 6.3 验收标准

- 所有单元测试通过
- 所有集成测试通过
- 代码覆盖率 > 80%
- 流式处理性能：O(n) 复杂度
- 压缩效率：Token 减少 > 50%
- 错误恢复成功率 > 95%
- 成本追踪准确率 100%
