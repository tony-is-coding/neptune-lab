> **文档状态**：✅ 最新（CC 原始能力分析文档）| 更新时间：2026-04-22

# Context Compactor 设计文档

## 一、功能概述

### 1.1 功能目标

Context Compactor 是 QueryEngine 内部的核心组件，负责在 Agent Loop 过程中管理上下文窗口，确保消息历史不超过模型限制，同时最大化 Prompt Cache 命中率。

**核心价值：**
- **Token 控制**：确保上下文不超过模型限制
- **智能压缩**：保留关键信息，移除冗余内容
- **缓存优化**：最大化 Prompt Cache 命中率，降低成本
- **性能保证**：压缩算法经过精心优化，保证性能

### 1.2 解决的问题

**问题 1：上下文超限**
- 现状：对话历史、工具结果、文件内容会导致上下文超过模型限制
- 方案：5 级压缩流水线，逐级压缩直到满足限制

**问题 2：缓存失效**
- 现状：上下文变化会导致 Prompt Cache 失效，增加成本
- 方案：消息不可变原则，保持字节级一致性

**问题 3：信息丢失**
- 现状：简单的裁剪会丢失关键信息
- 方案：智能压缩策略，保留关键信息

### 1.3 为什么不开放扩展

Context Compactor 是 **内部实现**，不对外开放扩展，原因如下：

1. **与 QueryEngine 深度耦合**：压缩逻辑与 query() 循环紧密集成，任何变化都可能影响核心流程
2. **核心算法**：5 级压缩流水线是经过精心设计和优化的，保证性能和正确性
3. **缓存敏感**：任何变化都可能导致 Prompt Cache 失效，增加成本
4. **风险可控**：保持内部实现，避免用户错误配置导致的问题

**设计原则：**
- 上下文加载（Agent Loop 前）可扩展 → Context Loader Provider
- 上下文压缩（Loop 过程中）不可扩展 → Context Compactor（内部实现）

## 二、设计目标

### 2.1 功能性目标

1. **Token 控制**：确保上下文不超过模型限制
2. **智能压缩**：保留关键信息，移除冗余内容
3. **缓存优化**：最大化 Prompt Cache 命中率
4. **性能保证**：压缩 < 1s，不阻塞用户输入

### 2.2 非功能性目标

1. **性能**：压缩 < 1s，Token 估算 < 10ms
2. **准确性**：信息保留率 > 90%
3. **可靠性**：压缩失败时有降级策略
4. **可观测性**：压缩过程可监控，便于调优

### 2.3 约束条件

1. **消息不可变**：发送给 API 的消息必须保持字节级一致
2. **缓存友好**：压缩策略必须考虑 Prompt Cache
3. **性能优先**：压缩不能成为瓶颈

## 三、技术方案

### 3.1 整体架构

```
QueryEngine.query() 循环
    ↓
每次 API 调用前
    ↓
Context Compactor.compact(messages, tokenLimit)
    ↓
5 级压缩流水线
    ├─ 1. 工具结果预算（Tool Result Budget）
    │    限制工具输出的大小
    ├─ 2. Snip (剪裁)
    │    移除陈旧的对话片段
    ├─ 3. Microcompact (微压缩)
    │    缓存感知的文件编辑记录
    ├─ 4. Context Collapse (上下文折叠)
    │    归档旧的回合
    └─ 5. Autocompact (自动压缩)
         当接近 Token 限制时进行全文摘要
    ↓
返回压缩后的消息
    ↓
调用 LLM API
```

### 3.2 核心流程

#### 3.2.1 压缩流水线

```
while (true) {
    // 1. 预处理：5 级压缩流水线
    messages = await compactor.compact(messages, tokenLimit)
    
    // 2. 调用 API：流式获取响应
    response = await llm.chat(messages)
    
    // 3. 后处理：执行工具，处理错误
    if (response.tool_use) {
        results = await runTools(response.tool_use)
        messages.push(results)
    }
    
    // 4. 决策：继续或终止
    if (response.end_turn) break
}
```

#### 3.2.2 5 级压缩流水线详解

**级别 1：工具结果预算（Tool Result Budget）**
- **目标**：限制工具输出的大小
- **策略**：
  - 为每个工具结果设置 Token 预算
  - 超过预算的结果被截断
  - 保留前后部分，中间用 "..." 替代
- **触发条件**：工具结果超过预算
- **示例**：
  ```
  原始：10,000 行文件内容
  压缩：前 100 行 + "... (9,800 lines omitted) ..." + 后 100 行
  ```

**级别 2：Snip (剪裁)**
- **目标**：移除陈旧的对话片段
- **策略**：
  - 识别"陈旧"的消息（距离当前回合较远）
  - 移除这些消息，保留最近的对话
  - 保留系统提示和关键上下文
- **触发条件**：消息数量超过阈值
- **示例**：
  ```
  原始：100 条消息
  压缩：保留最近 50 条，移除前 50 条
  ```

**级别 3：Microcompact (微压缩)**
- **目标**：缓存感知的文件编辑记录
- **策略**：
  - 识别文件编辑操作（Read → Edit → Write）
  - 合并连续的编辑操作
  - 保留最终状态，移除中间步骤
  - 考虑 Prompt Cache，避免破坏缓存
- **触发条件**：检测到连续的文件编辑
- **示例**：
  ```
  原始：Read file.ts → Edit line 10 → Edit line 20 → Write file.ts
  压缩：Read file.ts → Edit (merged changes) → Write file.ts
  ```

**级别 4：Context Collapse (上下文折叠)**
- **目标**：归档旧的回合
- **策略**：
  - 识别完整的"回合"（用户输入 → LLM 响应 → 工具执行 → LLM 响应）
  - 将旧回合折叠为摘要
  - 保留关键信息（任务目标、重要决策）
- **触发条件**：回合数量超过阈值
- **示例**：
  ```
  原始：
    User: Fix bug in auth.ts
    Assistant: [分析] → [执行] → [结果]
  压缩：
    [Collapsed] Fixed bug in auth.ts (3 tool calls, 2 edits)
  ```

**级别 5：Autocompact (自动压缩)**
- **目标**：当接近 Token 限制时进行全文摘要
- **策略**：
  - 使用 LLM 生成对话摘要
  - 保留关键信息（任务目标、当前状态、待办事项）
  - 替换原始消息为摘要
- **触发条件**：Token 数接近限制（> 90%）
- **示例**：
  ```
  原始：50 条消息，80,000 tokens
  压缩：摘要 + 最近 10 条消息，40,000 tokens
  ```

### 3.3 数据结构

#### 3.3.1 Context Compactor 类

```typescript
/**
 * Context Compactor（内部实现）
 * 负责 Loop 过程中的上下文压缩
 */
class ContextCompactor {
  /**
   * 压缩消息历史
   * @param messages - 原始消息列表
   * @param tokenLimit - Token 限制
   * @returns 压缩后的消息列表
   */
  async compact(
    messages: Message[], 
    tokenLimit: number
  ): Promise<Message[]> {
    let compacted = messages
    
    // 级别 1：工具结果预算
    compacted = await this.applyToolResultBudget(compacted)
    
    // 级别 2：Snip (剪裁)
    compacted = await this.snip(compacted, tokenLimit)
    
    // 级别 3：Microcompact (微压缩)
    compacted = await this.microcompact(compacted)
    
    // 级别 4：Context Collapse (上下文折叠)
    if (this.shouldCollapse(compacted, tokenLimit)) {
      compacted = await this.collapse(compacted)
    }
    
    // 级别 5：Autocompact (自动压缩)
    if (this.shouldAutocompact(compacted, tokenLimit)) {
      compacted = await this.autocompact(compacted)
    }
    
    return compacted
  }
  
  /**
   * 估算 Token 数
   */
  estimateTokens(messages: Message[]): number {
    // 使用 tiktoken 或类似库估算
  }
  
  /**
   * 判断是否需要折叠
   */
  private shouldCollapse(
    messages: Message[], 
    tokenLimit: number
  ): boolean {
    const tokens = this.estimateTokens(messages)
    return tokens > tokenLimit * 0.7
  }
  
  /**
   * 判断是否需要自动压缩
   */
  private shouldAutocompact(
    messages: Message[], 
    tokenLimit: number
  ): boolean {
    const tokens = this.estimateTokens(messages)
    return tokens > tokenLimit * 0.9
  }
}
```

#### 3.3.2 消息不可变原则

```typescript
/**
 * 消息不可变原则
 * 
 * 发送给 API 的消息必须保持字节级一致，
 * 任何变化都会使 Prompt Cache 失效。
 */

// ❌ 错误：直接修改消息
function badCompact(messages: Message[]): Message[] {
  messages[0].content = "compressed"  // 破坏缓存！
  return messages
}

// ✅ 正确：创建新消息
function goodCompact(messages: Message[]): Message[] {
  return messages.map(msg => ({
    ...msg,
    content: compress(msg.content)
  }))
}

// ✅ 正确：仅添加新字段（不破坏缓存）
function backfill(messages: Message[]): Message[] {
  return messages.map(msg => {
    if (!msg.metadata) {
      // 添加新字段，不修改已有字段
      return { ...msg, metadata: {} }
    }
    return msg
  })
}
```

### 3.4 关键设计原则

#### 3.4.1 消息不可变原则

**原则：**
- 发送给 API 的消息在跨轮次时必须保持字节级一致
- 任何变化都会使 Prompt Cache 失效，增加成本

**实现：**
- 压缩时创建新消息，不修改原消息
- 仅当 backfill 添加新字段时才克隆消息
- 使用 Object.freeze() 防止意外修改

**示例：**
```typescript
// 压缩前
const original = [
  { role: 'user', content: 'Hello' },
  { role: 'assistant', content: 'Hi' }
]

// 压缩后（创建新数组，不修改原数组）
const compacted = [
  { role: 'user', content: 'Hello' },
  { role: 'assistant', content: 'Hi' }
]

// 验证：original !== compacted
// 但内容相同，Prompt Cache 仍然有效
```

#### 3.4.2 Prompt Cache 优化

**原则：**
- 静态部分（系统提示）使用 global scope
- 动态部分（用户上下文）使用 session scope
- 消息历史不使用缓存（频繁变化）

**实现：**
- 在系统提示中插入缓存断点（DYNAMIC_BOUNDARY）
- 压缩时保持缓存断点位置不变
- 避免修改已缓存的内容

**示例：**
```typescript
const systemPrompt = [
  // 静态部分（global scope）
  { type: 'text', text: 'You are Claude...', cache_control: { type: 'ephemeral' } },
  
  // 缓存断点
  { type: 'text', text: '--- DYNAMIC_BOUNDARY ---' },
  
  // 动态部分（session scope）
  { type: 'text', text: 'Current date: 2026-04-19', cache_control: { type: 'ephemeral' } }
]
```

#### 3.4.3 性能优化

**原则：**
- 压缩 < 1s，不阻塞用户输入
- Token 估算 < 10ms
- 避免不必要的压缩

**实现：**
- 使用快速的 Token 估算算法（tiktoken）
- 仅在必要时触发压缩
- 缓存压缩结果

## 四、实现计划

### 4.1 实现步骤

**阶段 1：基础框架（2 天）**
1. 定义 ContextCompactor 类
2. 实现 Token 估算
3. 实现压缩流水线框架

**阶段 2：级别 1-2 压缩（3 天）**
1. 实现工具结果预算
2. 实现 Snip (剪裁)
3. 单元测试

**阶段 3：级别 3-4 压缩（3 天）**
1. 实现 Microcompact (微压缩)
2. 实现 Context Collapse (上下文折叠)
3. 单元测试

**阶段 4：级别 5 压缩（3 天）**
1. 实现 Autocompact (自动压缩)
2. 集成 LLM 摘要生成
3. 单元测试

**阶段 5：集成和优化（2 天）**
1. 集成到 QueryEngine
2. 性能优化
3. 端到端测试

**阶段 6：测试和文档（2 天）**
1. 单元测试（覆盖率 > 80%）
2. 集成测试
3. 性能测试
4. 编写内部文档

### 4.2 依赖关系

```
基础框架
    ↓
级别 1-2 压缩
    ↓
级别 3-4 压缩
    ↓
级别 5 压缩
    ↓
集成和优化
    ↓
测试和文档
```

### 4.3 里程碑

| 里程碑 | 交付物 | 验收标准 |
|--------|--------|----------|
| M1: 基础框架完成 | ContextCompactor 类 | 类定义完整，Token 估算正常 |
| M2: 级别 1-2 完成 | 工具结果预算、Snip | 压缩率 > 30%，测试通过 |
| M3: 级别 3-4 完成 | Microcompact、Collapse | 压缩率 > 50%，测试通过 |
| M4: 级别 5 完成 | Autocompact | 压缩率 > 70%，测试通过 |
| M5: 集成完成 | QueryEngine 集成 | 端到端测试通过 |
| M6: 测试和文档完成 | 测试用例、文档 | 覆盖率 > 80%，文档完整 |

## 五、测试计划

### 5.1 测试策略

**单元测试：**
- 每个压缩级别独立测试
- Mock LLM 调用
- 覆盖率 > 80%

**集成测试：**
- 测试与 QueryEngine 的集成
- 测试压缩流水线
- 测试缓存命中率

**性能测试：**
- 测试压缩性能（< 1s）
- 测试 Token 估算性能（< 10ms）
- 测试信息保留率（> 90%）

### 5.2 测试用例

#### 5.2.1 工具结果预算测试

```typescript
describe('Tool Result Budget', () => {
  it('should truncate large tool results', async () => {
    const compactor = new ContextCompactor()
    
    const messages = [
      {
        role: 'user',
        content: 'Read large file'
      },
      {
        role: 'assistant',
        content: [
          { type: 'tool_use', id: '1', name: 'read', input: {} }
        ]
      },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: '1',
            content: 'A'.repeat(100000)  // 100,000 字符
          }
        ]
      }
    ]
    
    const compacted = await compactor.applyToolResultBudget(messages)
    
    // 验证结果被截断
    const toolResult = compacted[2].content[0]
    expect(toolResult.content.length).toBeLessThan(10000)
    expect(toolResult.content).toContain('...')
  })
})
```

#### 5.2.2 Snip 测试

```typescript
describe('Snip', () => {
  it('should remove old messages', async () => {
    const compactor = new ContextCompactor()
    
    const messages = Array.from({ length: 100 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${i}`
    }))
    
    const compacted = await compactor.snip(messages, 50000)
    
    // 验证旧消息被移除
    expect(compacted.length).toBeLessThan(messages.length)
    
    // 验证最近的消息保留
    expect(compacted[compacted.length - 1].content).toBe('Message 99')
  })
})
```

#### 5.2.3 消息不可变测试

```typescript
describe('Message Immutability', () => {
  it('should not modify original messages', async () => {
    const compactor = new ContextCompactor()
    
    const original = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi' }
    ]
    
    const originalCopy = JSON.parse(JSON.stringify(original))
    
    await compactor.compact(original, 100000)
    
    // 验证原始消息未被修改
    expect(original).toEqual(originalCopy)
  })
})
```

#### 5.2.4 Prompt Cache 测试

```typescript
describe('Prompt Cache', () => {
  it('should preserve cache breakpoints', async () => {
    const compactor = new ContextCompactor()
    
    const messages = [
      {
        role: 'system',
        content: [
          { type: 'text', text: 'Static', cache_control: { type: 'ephemeral' } },
          { type: 'text', text: '--- DYNAMIC_BOUNDARY ---' },
          { type: 'text', text: 'Dynamic', cache_control: { type: 'ephemeral' } }
        ]
      },
      // ... 其他消息
    ]
    
    const compacted = await compactor.compact(messages, 100000)
    
    // 验证缓存断点保留
    const systemMsg = compacted[0]
    expect(systemMsg.content[1].text).toBe('--- DYNAMIC_BOUNDARY ---')
  })
})
```

### 5.3 验收标准

**功能验收：**
- ✅ 5 级压缩流水线正常工作
- ✅ Token 控制生效，不超过限制
- ✅ 消息不可变原则得到保证
- ✅ Prompt Cache 命中率 > 80%

**质量验收：**
- ✅ 单元测试覆盖率 > 80%
- ✅ 集成测试通过
- ✅ 性能测试达标
- ✅ 内部文档完整

**性能验收：**
- ✅ 压缩 < 1s
- ✅ Token 估算 < 10ms
- ✅ 信息保留率 > 90%
- ✅ Prompt Cache 命中率 > 80%

## 六、参考实现

### 6.1 Claude Code 现有实现

**核心文件：**
- `src/query.ts` - query() 循环（1,730 行）
- `src/services/compact/` - 压缩系统
- `src/utils/messages.ts` - 消息规范化（1,989+ 行）

**关键设计：**
- 5 级压缩流水线：预算 → 剪裁 → 微压缩 → 折叠 → 自动压缩
- 消息不可变原则：yield 前克隆
- Prompt Cache 优化：DYNAMIC_BOUNDARY 分隔静态和动态部分

### 6.2 设计模式

**模式 1：流水线模式**
- 问题：压缩策略多样，需要灵活组合
- 方案：5 级流水线，逐级压缩

**模式 2：消息不可变**
- 问题：修改消息会破坏 Prompt Cache
- 方案：创建新消息，不修改原消息

**模式 3：缓存断点**
- 问题：动态内容变化会导致缓存失效
- 方案：用 DYNAMIC_BOUNDARY 分隔静态和动态部分

**模式 4：延迟压缩**
- 问题：过早压缩会丢失信息
- 方案：仅在必要时触发压缩

## 七、总结

Context Compactor 是 QueryEngine 内部的核心组件，负责在 Agent Loop 过程中管理上下文窗口。它通过 5 级压缩流水线，确保上下文不超过模型限制，同时最大化 Prompt Cache 命中率。

**核心特点：**
- **内部实现**：不对外开放扩展，保证性能和正确性
- **5 级流水线**：工具结果预算 → Snip → Microcompact → Collapse → Autocompact
- **消息不可变**：保持字节级一致性，避免破坏 Prompt Cache
- **性能优化**：压缩 < 1s，Token 估算 < 10ms

**与 Context Loader Provider 的区别：**
- **Context Loader Provider**：Agent Loop 前的上下文加载组装，可扩展
- **Context Compactor**：Loop 过程中的上下文压缩，内部实现，不可扩展

这种拆分使得职责清晰、风险可控，既保证了扩展性，又保证了核心算法的稳定性。
