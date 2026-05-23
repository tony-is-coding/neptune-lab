# 04 - Agent 运行时层 (Agent Runtime Layer)

> 目录: [4.1 执行引擎](#41-execution-engine) | [4.2 记忆系统](#42-memory-system) | [4.3 护栏](#43-guardrails) | [4.4 工具注册](#44-tool-registry) | [4.5 编排](#45-orchestration)

Agent 运行时层是整个系统的核心——Agent 如何「思考」、如何「行动」、如何处理复杂长任务。这一层决定了 Agent 的能力上限和可靠性下限。

> **设计哲学**：当底层模型足够强（GPT-4/Claude 3.5+ 级别）时，生产级系统应**信任模型能力 + 最小必要控制**——让 LLM 自主决策，只在边界处加护栏。过度的显式控制反而限制灵活性、增加维护成本。本文的生产级设计参考了 Claude Code 等成熟 Agent 产品的设计思想。

```
┌───────────────────────────────────────────────────────────────┐
│                    Agent Runtime Layer                         │
│                                                                │
│  ┌──────────────────┐  ┌─────────────┐  ┌──────────────────┐  │
│  │  Execution Engine │  │   Memory    │  │   Guardrails    │  │
│  │  执行引擎         │  │   System    │  │   护栏            │   │
│  │  • 隐式状态循环   │  │  • 工作记忆  │  │  • 工具权限检查   │   │
│  │  • 针对性熔断器   │  │  • 会话记忆  │  │  • 权限模式       │   │
│  │  • 预算/轮次控制  │  │  • 长期记忆  │  │  • 自定义 Hooks  │   │
│  │  • 约束注入式重规划│  │  • 多层压缩  │  │  • 分类器辅助     │  │
│  │  • 分层降级       │  │  • 异步预取  │  │                  │  │
│  └──────────────────┘  └─────────────┘  └──────────────────┘  │
│                                                               │
│  ┌──────────────────┐  ┌──────────────────────────────────┐   │
│  │  Tool Registry   │  │  Orchestration                    │  │
│  │  工具注册中心     │   │  编排                              │  │
│  │  • Schema 验证   │   │  • AgentLoop (LLM+Tool循环)       │  │
│  │  • 并发安全分区  │    │  • Workflow (DAG编排)              │  │
│  │  • 流式执行      │   │  • Coordinator+Worker (推荐)       │  │
│  │  • Pre/Post Hooks│   │  • Swarm (群智协作)                │  │
│  │  • 结果大小控制  │   │  • MoA (多视角)                    │  │
│  └──────────────────┘  └──────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

---

## 4.1 Execution Engine（执行引擎）

执行引擎是 Agent 的「大脑控制中枢」。它决定了 Agent 如何一步步推进任务、如何应对异常、如何保证任务最终完成。

### 从 while 循环到隐式状态循环

#### Demo 级：简单 while 循环

```python
# Demo: the simplest agent loop
def run_agent(user_input):
    messages = [{"role": "user", "content": user_input}]
    
    while True:
        response = openai.chat.completions.create(
            model="gpt-4",
            messages=messages,
            tools=tools
        )
        
        if response.tool_calls:
            for call in response.tool_calls:
                result = execute_tool(call)  # What if this fails?
                messages.append(result)      # What if messages grows too large?
        else:
            return response.content          # What if content is harmful?
        # No timeout, no step limit, no loop detection
        # Process crashes = all progress lost
```

**这段代码的隐含假设**：
- LLM 永远返回有效响应
- 工具调用永远成功
- 循环最终会终止
- messages 不会超过 Context Window
- 进程不会崩溃

#### 生产级：隐式状态循环（信任模型的设计）

生产级系统**不需要显式状态机**（INIT → PLAN → EXECUTE → VERIFY → COMPLETE）。当模型足够强时，显式状态图反而限制了模型的灵活性。更好的做法是：

**while(true) 循环 + 可变 State 对象 + transition 标记**

```python
# Production: implicit state loop
class State:
    messages: list           # conversation history
    turn_count: int          # current turn number
    transition: str | None   # why the previous iteration continued
    has_attempted_compact: bool
    recovery_count: int

def agent_loop(user_input, max_turns=50):
    state = State(messages=[user_msg(user_input)], turn_count=1)
    
    while True:
        # 1. Context management (multi-layer compression)
        state.messages = apply_context_management(state.messages)
        
        # 2. Call LLM (streaming)
        response = call_model(state.messages)
        
        # 3. Handle recoverable errors
        if response.error == "prompt_too_long":
            state = handle_context_overflow(state)
            continue  # retry with compressed context
        if response.error == "max_output_tokens":
            if state.recovery_count < 3:
                state = inject_continuation_hint(state)
                continue  # let LLM resume from cutoff
            # else: give up, return partial result
        
        # 4. No tool calls → task complete
        if not response.tool_calls:
            return response.content  # Terminal: completed
        
        # 5. Execute tools, append results
        tool_results = execute_tools(response.tool_calls)
        state.messages.extend(tool_results)
        
        # 6. Check turn limit
        state.turn_count += 1
        if state.turn_count > max_turns:
            return partial_result(state)  # Terminal: max_turns
        
        # 7. Continue next turn (implicit state transition)
        state.transition = "next_turn"
```

**核心设计思想**：

| 设计选择 | 理由 |
|---------|------|
| 不用显式状态机 | 模型自己决定何时搜索、何时执行、何时验证，比硬编码状态图更灵活 |
| transition 标记 | 记录"为什么继续"，用于调试和审计，但不控制流程 |
| 错误就地处理 | 每种错误在发生点立即处理，不走全局 error handler |
| 终止条件明确 | completed / max_turns / unrecoverable_error，三种退出路径 |

```
┌──────────────────────────────────────────────────────────────────┐
│              生产级 Agent Loop 结构                                │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  每轮迭代开始                                               │  │
│  │  • 上下文管理（多层压缩，详见 4.2）                         │  │
│  │  • 工具结果预算控制（截断过大的结果）                        │  │
│  └────────────────────────────────────────────────────────────┘  │
│                          ↓                                        │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  调用 LLM（流式输出）                                       │  │
│  │  • 流式输出期间即可开始执行工具（不等流结束）               │  │
│  │  • 拦截可恢复错误（上下文过长 / 输出截断）                  │  │
│  └────────────────────────────────────────────────────────────┘  │
│                          ↓                                        │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  无工具调用 → 任务完成路径                                   │  │
│  │  → 可恢复错误? → 压缩/续跑 → continue                      │  │
│  │  → 自定义 Hooks 检查 → 可能注入错误让 LLM 修复             │  │
│  │  → Token 预算检查 → 可能续跑                                │  │
│  │  → return completed                                         │  │
│  └────────────────────────────────────────────────────────────┘  │
│                          ↓（有工具调用）                          │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  执行工具                                                    │  │
│  │  → 并发安全的批量执行（只读工具可并发）                      │  │
│  │  → 检查轮次限制 → 超限则退出                                │  │
│  │  → 注入附加信息（记忆、上下文补充）                          │  │
│  │  → continue（下一轮迭代）                                    │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### 循环检测与熔断

Agent 最常见的生产事故之一是**陷入循环**——反复执行相同的动作却无法推进。

#### Demo 思路：通用循环检测器

```python
# Demo approach: generic loop detector
class LoopDetector:
    def __init__(self, window_size=10, threshold=3):
        self.recent_actions = []
    
    def detect(self, action):
        action_hash = hash(action)
        self.recent_actions.append(action_hash)
        # Check for exact repetition or cycle patterns
        ...
```

这种方案的问题：
- 误判率高——多次读取不同文件看起来像"重复调用 read"
- 检测到循环后怎么办？通用策略（"换一种方法"）对 LLM 没有实际帮助
- 哈希相似度判断不可靠，参数微小变化就绕过检测

#### 生产级：针对性熔断器

生产系统不需要通用循环检测。更好的做法是**为每种已知失败模式设置专用熔断器**：

| 失败模式 | 熔断策略 | 阈值 |
|---------|---------|------|
| 输出截断 → 续跑 → 再截断 | 续跑计数器，超限则放弃 | 最多 3 次 |
| 上下文过长 → 压缩 → 仍过长 | 布尔标志，压缩只尝试一次 | 1 次 |
| 自动压缩失败 → 重试 → 再失败 | 连续失败计数器 | 最多 3 次 |
| API 过载 → 重试 → 仍过载 | 重试计数 + 指数退避 | 前台 3 次，后台 0 次 |
| 收益递减（模型卡住） | 连续 N 轮产出低于阈值 | 3 轮 × <500 tokens |

```python
# Production: targeted circuit breakers
class AgentState:
    recovery_count: int = 0          # output truncation recovery
    has_attempted_compact: bool = False  # context overflow
    consecutive_compact_failures: int = 0
    continuation_count: int = 0      # diminishing returns tracking

# Each failure mode has its own breaker
if error == "max_output_tokens":
    if state.recovery_count < 3:
        inject_message("Resume from where you left off.")
        state.recovery_count += 1
        continue
    else:
        return partial_result()  # breaker tripped

if error == "prompt_too_long":
    if not state.has_attempted_compact:
        compact_conversation(state.messages)
        state.has_attempted_compact = True
        continue
    else:
        return error("Context too large to recover")  # breaker tripped
```

#### 收益递减检测（Diminishing Returns）

这是一种轻量级的"卡住"检测，不依赖 action hash：

```
判断逻辑:
  如果连续 3+ 轮，每轮模型新增输出 < 500 tokens
  → 判定为"模型在空转"，停止循环

为什么有效:
  • 正常工作时，模型每轮都有实质性输出（调用工具、生成代码）
  • 卡住时，模型倾向于输出短小的犹豫性文本
  • 不需要比较 action 内容，只看产出量
```

#### 设计原则

| 原则 | 理由 |
|------|------|
| 局部熔断 > 全局检测 | 每种循环的根因不同，需要不同的恢复策略 |
| 计数器 > 哈希比对 | 更可靠，不依赖相似度判断 |
| 快速失败 > 无限重试 | 3 次是经验值——足够排除偶发错误，又不会浪费太多资源 |
| 后台任务更保守 | 后台无人值守，重试可能级联放大问题 |

### 超时与预算控制

生产系统用**多维度边界**控制执行，而不是简单的时间超时：

```
┌─────────────────────────────────────────────────────────┐
│  维度 1: 轮次限制 (Max Turns)                            │
│  每次任务的最大 LLM+工具 循环轮次                        │
│                                                          │
│  简单任务: 10-20 轮                                      │
│  复杂任务: 50-100 轮                                     │
│  超限时: 返回已完成的部分结果                             │
├─────────────────────────────────────────────────────────┤
│  维度 2: 成本预算 (Budget)                               │
│  每次任务的最大 API 费用（USD）                           │
│                                                          │
│  每轮检查累计成本，超限时优雅退出                         │
│  用户可配置上限，防止意外高额账单                         │
├─────────────────────────────────────────────────────────┤
│  维度 3: 收益递减检测 (Diminishing Returns)              │
│  当模型产出持续低于阈值时自动停止                         │
│                                                          │
│  < 90% 预算: 注入续跑提示，继续                          │
│  >= 90% 或连续低产出: 停止                               │
│  判断标准: 连续 3 轮，每轮新增 < 500 tokens              │
├─────────────────────────────────────────────────────────┤
│  维度 4: 工具级超时                                      │
│  每个工具调用有独立的超时限制                             │
│                                                          │
│  Shell 命令: 120s（可配置）                              │
│  网络请求: 30s                                           │
│  文件操作: 10s                                           │
└─────────────────────────────────────────────────────────┘
```

**API 重试策略**：

| 场景 | 策略 | 理由 |
|------|------|------|
| 前台请求遇到过载 (529) | 最多重试 3 次，指数退避 | 用户在等，但不能无限等 |
| 前台请求遇到限流 (429) | 最多重试 10 次，指数退避 | 限流通常很快恢复 |
| 后台请求遇到过载 | 不重试，直接失败 | 避免级联放大 |
| 无人值守模式 | 无限重试，最大退避 5min | 没有人在等，可以慢慢来 |
| 连接重置 (ECONNRESET) | 自动重试 | 网络抖动，重试通常成功 |

**用户中断处理**：

```
任何阶段收到中断信号后:
  流式输出阶段 → 立即停止接收，返回已收到的内容
  工具执行阶段 → 为未完成的工具生成合成结果
                 → 保证消息链完整（每个 tool_use 都有 tool_result）
                 → 这样会话可以被恢复（resume）
```

### 重规划（Re-planning）

#### Demo 思路：显式 REPLAN 状态

```
EXECUTE → 失败 → REPLAN → 重新生成计划 → EXECUTE
```

问题：
- 重规划本身消耗大量 token（要重新理解上下文 + 生成新计划）
- 硬编码的"何时重规划"规则容易过度触发或遗漏
- 新计划可能和旧计划冲突，需要额外的一致性检查

#### 生产级：约束注入，让模型自行调整

生产系统不需要显式的"回到规划阶段"。更好的做法是**把失败信息追加到 messages 中**，让 LLM 在下一轮自然调整策略。

```
核心原则:
  • 不清空历史，只追加新约束
  • 让 LLM 自主决定如何调整（不硬编码策略）
  • 每种失败模式有专用的恢复路径

实际触发场景:

  1. 上下文过长
     → 压缩历史（保留关键信息）→ 继续执行
     → 压缩失败 → 返回错误，用户需重新开始

  2. 输出截断
     → 注入: "Output was cut off. Resume from where you left off."
     → LLM 从截断处继续，最多 3 次

  3. 自定义 Hook 返回错误（如测试失败）
     → 将错误信息作为 user message 注入
     → LLM 看到 "test failed: xxx" 后自然修复代码

  4. 工具调用失败
     → 工具返回 is_error: true 的结果
     → LLM 看到错误后自主决定：重试/换工具/换策略
     → 无自动重试（由 LLM 决策）

  5. 模型降级
     → 主模型不可用时切换到 fallback 模型
     → 清空当前轮的未完成输出
     → 用新模型重新请求（保留完整历史）
```

**为什么这比显式 REPLAN 更好**：
- 零额外 token 开销（不需要单独的"规划 LLM 调用"）
- 模型能看到完整的失败上下文，做出更好的决策
- 不会出现"新计划和旧计划冲突"的问题
- 实现极其简单——就是往 messages 里追加一条消息

### 降级策略

生产系统的降级是**分层的、就地的**——在每个具体失败点立即处理，而不是走全局 error handler。

```
降级层次（从轻到重）:

┌──────────────────┬──────────────────────────────────────────┐
│  失败场景         │  降级策略                                 │
├──────────────────┼──────────────────────────────────────────┤
│  输出截断         │  升级 max_tokens 重试一次                 │
│                  │  → 仍截断: 注入续跑提示，最多 3 次        │
│                  │  → 3 次后: 返回部分结果，标记未完成        │
├──────────────────┼──────────────────────────────────────────┤
│  上下文过长       │  先尝试折叠旧内容（轻量级）               │
│                  │  → 失败: LLM 摘要压缩（重量级）           │
│                  │  → 仍失败: 返回错误                       │
├──────────────────┼──────────────────────────────────────────┤
│  模型过载/不可用  │  指数退避重试（前台最多 3 次）            │
│                  │  → 仍失败: 切换 fallback 模型重试         │
│                  │  → 仍失败: 返回服务不可用                 │
├──────────────────┼──────────────────────────────────────────┤
│  工具执行失败     │  返回错误信息给 LLM                      │
│                  │  → LLM 自主决定是否重试或换策略           │
│                  │  → 无自动重试（信任模型判断）             │
├──────────────────┼──────────────────────────────────────────┤
│  用户中断         │  为未完成工具生成合成结果                 │
│                  │  → 保证消息链完整，支持后续恢复           │
├──────────────────┼──────────────────────────────────────────┤
│  成本超预算       │  优雅退出，返回已完成的部分结果           │
│                  │  → 告知用户如何调整预算继续               │
└──────────────────┴──────────────────────────────────────────┘
```

**关键设计**：
- 降级不依赖全局错误处理，而是在每个失败点就地处理
- 保证消息链完整性（每个 tool_use 必须有对应的 tool_result）——这是会话可恢复的前提
- 工具失败不自动重试——让 LLM 决定，因为它有上下文判断"是否值得重试"

---

## 4.2 Memory System（记忆系统）

### 为什么 Demo 的 messages 列表不够

```
Demo 的记忆 = messages 列表:
  [system_prompt, user_msg_1, assistant_msg_1, user_msg_2, ...]

问题:
  1. Context Window 有限（模型相关，128K-1M tokens）
     → 长任务产生的中间结果可能超过窗口容量
     → 超过后需要压缩，丢失早期细节

  2. 没有跨会话记忆
     → 用户昨天说过的偏好，今天 Agent 不记得
     → 每次对话都从零开始

  3. 没有选择性记忆
     → 所有信息同等对待，无法区分重要和不重要
     → 冗余的推理过程占用宝贵的 Context Window

  4. 没有记忆检索
     → 只能按时间顺序访问（最近的在最后）
     → 无法按语义相关性检索历史信息
```

### 三层记忆架构

```
┌────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐│
│  │  Working Memory（工作记忆）                                ││
│  │                                                            ││
│  │  位置: LLM 的 messages 数组（内存）                        ││
│  │  容量: 受 Context Window 限制                              ││
│  │  内容:                                                     ││
│  │    • System Prompt（角色定义、工具描述）                    ││
│  │    • 当前会话的消息历史                                     ││
│  │    • 工具调用结果                                           ││
│  │    • 从长期记忆中检索注入的相关信息                         ││
│  │  生命周期: 单次 LLM 调用                                   ││
│  │  管理策略: 每轮动态组装，多层压缩控制大小                  ││
│  └───────────────────────────────────────────────────────────┘│
│                          ↕ 读写                                │
│  ┌───────────────────────────────────────────────────────────┐│
│  │  Session Memory（会话记忆）                                ││
│  │                                                            ││
│  │  位置: 本地文件（如 JSONL 格式的 transcript）              ││
│  │  容量: 无硬限制                                            ││
│  │  内容:                                                     ││
│  │    • 完整对话历史（每条消息实时写入）                       ││
│  │    • 工具调用的完整参数和返回值                             ││
│  │    • 压缩边界标记（支持 resume）                           ││
│  │  生命周期: 会话级（支持恢复）                               ││
│  │  管理策略: 自动压缩 + 边界标记                             ││
│  └───────────────────────────────────────────────────────────┘│
│                          ↕ 读写                                │
│  ┌───────────────────────────────────────────────────────────┐│
│  │  Long-term Memory（长期记忆）                              ││
│  │                                                            ││
│  │  位置: 文件系统（Markdown 文件）或向量数据库               ││
│  │  容量: 无限制                                              ││
│  │  内容:                                                     ││
│  │    • 用户偏好（"用户喜欢简洁的回答"）                      ││
│  │    • 项目上下文（约定、架构决策）                           ││
│  │    • 历史任务的关键结论                                     ││
│  │    • 用户反馈和行为模式                                     ││
│  │  生命周期: 永久（跨会话）                                   ││
│  │  管理策略: 异步预取 + 去重注入                             ││
│  └───────────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────────┘
```

**务实选择：文件系统 vs 向量数据库**

| 方案 | 适用场景 | 优点 | 缺点 |
|------|---------|------|------|
| 文件系统 (Markdown) | 记忆量小（<200条）、开发者工具 | 实现简单、可人工编辑、无外部依赖 | 无语义检索、全量注入成本随记忆增长 |
| 向量数据库 | 记忆量大、需要语义检索 | 精准检索、支持海量记忆 | 需要额外基础设施、嵌入模型成本 |

对于大多数 Agent 产品，**文件系统方案足够**——记忆索引全量注入 System Prompt，需要详情时再读取具体文件。当记忆量超过 200 条或需要跨用户检索时，再引入向量数据库。

### Context Window 管理：多层压缩

Context Window 是稀缺资源。生产系统需要**多层压缩策略**，从轻到重依次触发：

```
层次一：工具结果释放（每轮自动，零成本）
  每轮迭代开始时释放上一轮工具结果的原始对象
  只保留 API 格式的 content（通常更小）
  效果: 防止大文件读取结果在内存中无限积累

层次二：工具结果预算（每轮自动，零成本）
  每条工具结果有大小上限（如 50K chars）
  超出上限的内容被截断
  截断信息可在后续恢复（如重新读取文件）

层次三：历史片段压缩（轻量级）
  选择性删除历史中的冗余片段
  保留关键决策和结论
  不需要 LLM 调用

层次四：自动摘要压缩（重量级，需要 LLM 调用）
  触发条件: token 数 > 有效窗口 × 87%
    • 200K 窗口: 约 167K 时触发
    • 1M 窗口: 约 930K 时触发

  压缩流程:
    1. Fork 一个子进程/子 Agent 做摘要（不阻塞主线程）
    2. 用摘要替换历史消息
    3. 写入压缩边界标记（支持 resume）
    4. 压缩后恢复最近访问的关键文件（保持上下文连贯）

  熔断: 连续失败 3 次后停止重试

层次五：响应式压缩（兜底）
  触发条件: API 返回 "prompt too long" 错误
  说明预测性阈值未能覆盖实际增长
  立即触发压缩，重试请求
  只尝试一次（避免死循环）
```

**设计要点**：
- 前三层零成本，每轮都执行
- 第四层有 LLM 成本，只在接近上限时触发
- 第五层是兜底，正常情况不应触发
- 压缩在子进程中执行，不阻塞用户交互

### 长期记忆的读写策略

```
写入（任务完成后异步执行）:
  • 提取值得长期保存的信息:
    - 用户表达的偏好 → 写入 "用户偏好" 类别
    - 项目的关键决策 → 写入 "项目上下文" 类别
    - 用户的负面反馈 → 写入 "行为调整" 类别
  • 异步执行，不阻塞当前任务
  • 去重：检查是否已有类似记忆，有则更新而非新增

检索（新任务开始时异步预取）:
  1. 任务开始时异步启动检索（隐藏延迟）
  2. 检索结果作为附加信息注入 messages
  3. 去重过滤：避免同一记忆在多轮中重复注入

  文件系统方案: 全量注入索引文件，按需读取详情
  向量数据库方案: 用当前任务描述做语义检索，返回 Top-K
```

### 记忆一致性

```
问题: 长期记忆与当前会话可能出现不一致

场景:
  长期记忆: "用户喜欢详细的报告"
  当前会话: "用户刚才说这次要简洁一点"

解决原则: 时间越近的信息优先级越高

  当前会话消息 > 长期记忆（最近的偏好覆盖历史偏好）
  显式表达 > 隐式推断（用户明确说的 > Agent 推断的）

实现方式（信任模型的设计）:
  • 长期记忆注入在 messages 较早位置
  • 当前会话消息在 messages 末尾
  • LLM 自然优先最近的内容（无需显式冲突检测）
  • 当记忆明显过时时，更新或删除
```

---

## 4.3 Guardrails（护栏）

> **注意**：本节 Guardrails 是 Runtime 层面的管道实现，对应 [平台服务层 3.2 安全](03-platform-services-layer.md) 中安全层的运行时落地。

### 设计哲学：以工具调用为核心

传统思路是四层全覆盖 Pipeline（Input Guard → Planning Guard → Tool Guard → Output Guard）。生产实践表明，当模型足够强时，**聚焦 Tool Guard 就够了**：

- Input Guard：模型自身 + System Prompt 约束已经足够过滤大部分恶意输入
- Planning Guard：不需要——因为我们不用显式 PLAN 阶段
- **Tool Guard：核心护栏**——工具调用是 Agent 影响外部世界的唯一通道
- Output Guard：模型自身约束 + 自定义 Hooks 覆盖

```
用户输入
  ↓
[输入处理] 解析命令、处理附件、验证格式（轻量级）
  ↓
[构建 Prompt] 注入 System Prompt、记忆、工具描述
  ↓
[调用 LLM] 流式输出
  ↓ 每个工具调用
[权限检查] ← 核心护栏（详见下文）
  ↓ allow
[工具执行] 超时控制 + 结果截断
  ↓
[自定义 Hooks] 用户定义的后处理检查（如运行测试）
  ↓ 通过
返回给用户
```

### 权限检查：核心护栏

每次工具调用前执行权限检查，决策流程：

```python
def check_permission(tool, input, context):
    # 1. Static rules (fastest path)
    if tool in always_allow_rules:
        return ALLOW
    if tool in always_deny_rules:
        return DENY
    
    # 2. Permission mode decides handling
    match context.permission_mode:
        case "bypass":       # trusted automation (CI/CD)
            return ALLOW
        case "auto":         # classifier judges safety
            return classifier_decision(tool, input)
        case "plan":         # read-only tools auto-allowed
            return ALLOW if tool.is_readonly else ASK_USER
        case "interactive":  # user confirms dangerous ops
            return ASK_USER if tool.is_dangerous else ALLOW
```

### 权限模式

| 模式 | 适用场景 | 策略 |
|------|---------|------|
| **bypass** | CI/CD、受信任的自动化 | 全部自动允许 |
| **auto** | 日常使用（推荐默认） | 分类器判断安全性，危险操作需确认 |
| **plan** | 代码审查、探索 | 只读工具自动允许，写操作需确认 |
| **interactive** | 手动操作、高安全要求 | 每次危险操作弹出确认框 |

### 风险等级分类

```
[低风险] 文件读取、搜索、代码分析
     → 所有模式下自动允许
     → 无需用户确认

[中风险] 文件写入、编辑、Shell 命令
     → auto 模式: 分类器判断（大部分自动允许）
     → 首次执行新类型操作: 可能需要确认
     → 用户可配置 always_allow 规则

[高风险] 删除操作、网络请求、系统命令
     → 默认需要用户确认
     → 可通过 always_allow 规则豁免

[禁止] 越权访问、敏感数据泄露
     → 直接拒绝，无法豁免
```

### 自定义 Hooks：用户可扩展的护栏

Hooks 是生产级护栏最强大的扩展点，让用户定义自己的安全检查：

```
Pre-tool Hooks（工具执行前）:
  • 可以修改权限决策（覆盖默认规则）
  • 可以修改工具参数
  • 典型用法: 企业级访问控制

Post-tool Hooks（工具执行后）:
  • 可以检查工具执行结果
  • 典型用法: 审计日志

Stop Hooks（每轮 LLM 响应结束后）:
  • 运行任意 shell 命令（如测试套件、lint、安全扫描）
  • 返回错误 → 注入 messages，LLM 看到错误后修复
  • 返回阻止 → 停止整个任务
  • 典型用法:
    - 每次修改后自动运行测试
    - 安全扫描（如 semgrep）
    - 代码风格检查
```

### Guard 实现方式选择

| 实现方式 | 延迟 | 准确度 | 推荐场景 |
|---------|------|--------|---------|
| **静态规则** (always_allow/deny) | <1ms | 高（精确匹配） | 已知安全/危险的操作 |
| **分类器** (小模型/规则引擎) | 10-50ms | 中高 | auto 模式的默认判断 |
| **用户确认** | 人工 | 最高 | 不确定的危险操作 |
| **自定义 Hooks** | 视命令 | 用户定义 | 企业级定制需求 |
| **LLM-as-Judge** | 1-5s | 高 | 不推荐（延迟和成本太高） |

**为什么不用 LLM-as-Judge**：每次工具调用前额外调用一次 LLM 判断安全性，延迟 +1-5s，成本翻倍。对于开发者工具场景，分类器 + 用户确认已经足够。

---

## 4.4 Tool Registry（工具注册与管理）

### Demo vs 生产的差距

```python
# Demo: tools as a flat list of dicts
tools = [
    {"name": "search", "description": "...", "parameters": {...}},
    {"name": "execute", "description": "...", "parameters": {...}},
]
# No validation, no timeout, no concurrency control, no size limits
```

生产系统需要回答：
- 参数不合法怎么办？（Schema 验证）
- 工具执行太慢怎么办？（超时控制）
- 多个工具能同时执行吗？（并发安全）
- 结果太大撑爆 Context Window 怎么办？（结果截断）
- 用户想加自己的工具怎么办？（动态注册）

### 工具定义结构

```python
# Production: tool definition with full metadata
class Tool:
    name: str                    # unique identifier
    description: str             # what LLM sees
    input_schema: JSONSchema     # parameter validation schema
    
    # Concurrency safety: read-only tools can run in parallel
    is_concurrency_safe: bool
    
    # Result size limit (truncate if exceeded)
    max_result_size: int | None  # e.g., 50_000 chars
    
    # Execution
    async def call(self, input, context) -> ToolResult: ...
    
    # Permission check (optional, for dangerous tools)
    async def check_permission(self, input, context) -> Decision: ...
```

**关键字段说明**：

| 字段 | 作用 | 为什么需要 |
|------|------|-----------|
| `input_schema` | 参数验证 | LLM 生成的参数可能不合法，验证后返回错误让 LLM 修正 |
| `is_concurrency_safe` | 并发控制 | 只读工具（搜索、读文件）可并发，写操作必须串行 |
| `max_result_size` | 结果截断 | 防止一次读取大文件撑爆 Context Window |
| `check_permission` | 权限检查 | 危险工具需要额外的安全检查 |

### 工具执行流程

```
Agent 请求调用工具
    ↓
[1] Schema 验证: 参数是否符合定义
    ├─ 不符合 → 返回格式化的验证错误，让 LLM 修正
    └─ 符合 ↓
[2] 权限检查（见 4.3 节）
    ├─ deny → 返回权限拒绝消息
    └─ allow ↓
[3] Pre-tool Hooks（用户自定义，可选）
    ├─ hook 修改决策 → 覆盖权限结果
    └─ 通过 ↓
[4] 执行（带超时）
    ├─ 超时 → 返回超时错误
    ├─ 失败 → 返回 is_error: true 的结果
    └─ 成功 ↓
[5] 结果大小控制
    ├─ 超过 max_result_size → 截断 + 标记
    └─ 正常 ↓
[6] Post-tool Hooks（用户自定义，可选）
    ↓
[7] 审计记录
    ↓
返回结果给 LLM
```

### 并发执行策略

LLM 经常在一次响应中请求多个工具调用。生产系统需要**智能分区**：

```
规则: 连续的并发安全工具 → 合并为一批并发执行
      非并发安全工具 → 单独串行执行

示例: LLM 同时请求 [ReadFile, ReadFile, Bash, ReadFile]
分区结果:
  Batch 1: [ReadFile, ReadFile]  → 并发执行
  Batch 2: [Bash]               → 串行执行（可能有副作用）
  Batch 3: [ReadFile]           → 执行

最大并发数: 可配置（如 10），防止资源耗尽
```

### 流式工具执行（高级优化）

```
传统方式:
  等待 LLM 输出完成 → 提取所有工具调用 → 执行 → 返回结果

流式方式:
  LLM 流式输出中 → 检测到完整的工具调用 → 立即开始执行
  → LLM 输出完成时，部分工具已经执行完毕

效果: 减少用户等待时间（工具执行与 LLM 输出并行）
前提: 工具之间无依赖关系
```

### 动态工具注册（MCP 协议）

生产系统需要支持运行时动态添加工具，而不是编译时固定：

```
静态工具: 内置的核心工具（文件操作、搜索、Shell）
动态工具: 通过 MCP (Model Context Protocol) 等协议注册
  • 外部服务声明自己提供哪些工具
  • 运行时发现并注册到工具列表
  • LLM 可以像使用内置工具一样使用它们

好处:
  • 用户可以扩展 Agent 能力而不改核心代码
  • 第三方服务可以提供专用工具
  • 工具生态可以独立演进
```

---

## 4.5 Orchestration（编排）

编排是 Agent 系统的「控制面」。不同编排模式的本质区别是**控制权的分配方式**。

> **生产首选推荐**：对于大多数场景，推荐「Coordinator + Worker」模式。Coordinator 保证宏观可控，Worker 保证微观灵活。

### 控制权谱系

```
完全确定性                                        完全自主
|─────────────────────────────────────────────────────|
  Workflow         AgentLoop       Coordinator     Swarm
  (代码控制)       (LLM自主决策)    (LLM分配任务)   (LLM自组织)
```

### 模式一：AgentLoop（LLM + Tool 循环）

所有 Agent 系统的基础模式。LLM 拥有完全决策权。就是 4.1 节描述的核心执行引擎。

```python
# Core pattern: LLM decides everything
while True:
    response = call_llm(messages)
    if response.has_tool_calls:
        results = execute_tools(response.tool_calls)
        messages.extend(results)
    else:
        return response.content
```

| 优点 | 缺点 |
|------|------|
| 最大灵活性，能处理未预见场景 | 不可预测，同样输入可能走不同路径 |
| 实现最简单 | 难以调试（哪步出了问题？） |
| 适合探索性任务 | 难以保证 SLA（延迟、成本不可控） |

**适用场景**：简单问答、开放式对话、单一领域任务

### 模式二：Workflow / DAG 编排

控制权在代码手里，LLM 只负责具体节点的执行。

```python
# Workflow: code controls the flow, LLM executes nodes
graph = StateGraph()
graph.add_node("classify", llm_classify_intent)
graph.add_node("search", tool_search)
graph.add_node("generate", llm_generate_response)

graph.add_edge("classify", route_by_intent, {
    "query": "search",
    "action": "execute"
})
graph.add_edge("search", "generate")
```

| 优点 | 缺点 |
|------|------|
| 完全可控，每步可预测 | 不够灵活，无法处理预定义外的场景 |
| 容易调试和追踪 | 流程变更需改代码重新部署 |
| 容易保证 SLA | 对 LLM 自主能力利用不足 |

**适用场景**：业务流程明确、合规要求高、需要可审计的场景

### 模式三：Coordinator + Worker（推荐）

**Coordinator 负责理解、分解、分派、汇总；Worker 负责执行具体任务。**

```
┌─────────────────────────────────────────────────────────────────┐
│                    Coordinator Agent                             │
│  职责: 理解任务 → 分解子任务 → 并行分派 → 汇总 → 质量检查       │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  Worker A    │  │  Worker B    │  │  Worker C    │         │
│  │  (调研)      │  │  (实现)      │  │  (测试)      │         │
│  │  只读工具集  │  │  完整工具集  │  │  执行工具集  │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                 │
│  通信方式: 结构化消息（Worker 完成后向 Coordinator 报告）        │
└─────────────────────────────────────────────────────────────────┘
```

**Coordinator 的工作流程**：

```
Phase 1: Research（并行）
  → 多个 Worker 同时调查代码库、理解问题
  → Coordinator 等待所有 Worker 完成

Phase 2: Synthesis（Coordinator 自己做）
  → 读取 Worker 的发现
  → 制定实现规格（不委托给 Worker）

Phase 3: Implementation（按文件集串行）
  → Worker 按规格实现
  → 写操作同一文件集只有一个 Worker（避免冲突）

Phase 4: Verification（可与 Implementation 并行）
  → Worker 运行测试、类型检查
  → 证明代码工作，不是橡皮图章
```

**并发控制原则**：
- 只读任务（Research）→ 自由并行
- 写操作（Implementation）→ 同一文件集串行
- Verification 可与不同文件区域的 Implementation 并行

**Worker 失败处理**：
- 优先继续同一 Worker（保留完整错误上下文）
- 如果修正失败，换策略或上报用户
- 可以停止走错方向的 Worker

**为什么推荐**：
- Coordinator 保证宏观可控（任务不会跑偏）
- Worker 保证微观灵活（具体步骤让 LLM 自主决策）
- 并行执行大幅提升效率
- Worker 失败不影响其他 Worker
- 每个 Worker 有独立的 Context Window（不会互相挤占）

### 模式四：Swarm（群智协作）

核心概念是 **Handoff（交接）**。Agent 之间通过交接控制权协作，没有固定 Coordinator。

```
Agent A (客服入口)
  "这个问题需要技术支持"
  → Handoff to Agent B

Agent B (技术支持)
  "需要查一下账户信息"
  → Handoff to Agent C

Agent C (账户管理)
  "处理完了"
  → Handoff back to Agent B

Agent B
  "问题已解决"
  → 返回用户
```

**Coordinator vs Swarm 对比**：

| 维度 | Coordinator | Swarm |
|------|-----------|-------|
| 控制流 | 中心化 | 去中心化 |
| 可预测性 | 较高 | 较低 |
| 灵活性 | 中 | 高 |
| 调试难度 | 中 | 高（路径不确定） |
| 循环风险 | Coordinator 可打破 | 需要额外防护 |
| 成本 | Coordinator 每次参与 | 更少总调用 |
| 适用 | 可分解的任务 | 客服路由场景 |

### 模式五：MoA (Mixture of Agents)

同一问题多个 Agent 分别回答，Aggregator 汇总。

```
用户问题
    ↓
┌──────────┐ ┌──────────┐ ┌──────────┐
│ Agent A  │ │ Agent B  │ │ Agent C  │
│ 乐观视角 │ │ 悲观视角 │ │ 中立视角 │
└────┬─────┘ └────┬─────┘ └────┬─────┘
     ↓             ↓             ↓
┌──────────────────────────────────────┐
│       Aggregator Agent               │
│  综合所有观点，交叉验证，形成最终答案 │
└──────────────────────────────────────┘
```

成本是单 Agent 的 N+1 倍。适合高质量决策分析。

### 编排模式决策矩阵

| 场景 | 推荐模式 | 理由 |
|------|---------|------|
| 简单问答、客服 | AgentLoop | 成本低，够用 |
| 审批流程、合规操作 | Workflow | 每步必须可审计 |
| 复杂任务（调研+实现+验证） | **Coordinator+Worker** | 并行高效 + 细节灵活 |
| 客户服务路由 | Swarm | 动态交接 |
| 高质量决策分析 | MoA | 多视角交叉验证 |

---

## 相关文档

| 文档 | 主题 |
|------|------|
| [01-global-map.md](01-global-map.md) | 全局地图：Demo vs 生产 |
| [02-infrastructure-layer.md](02-infrastructure-layer.md) | 基础设施层详细设计 |
| [03-platform-services-layer.md](03-platform-services-layer.md) | 平台服务层详细设计 |
| [05-application-layer.md](05-application-layer.md) | 应用层详细设计 |
| [06-production-roadmap.md](06-production-roadmap.md) | 生产化路线图 + 自检清单 |
