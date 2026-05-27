  # 上层 ↔ Engine 协议契约

**版本**：v1.0
**最后更新**：2026-05-26
**适用范围**：`neptune-ai/server` 与 `@neptune/engine` 之间的协议层；记录上层（产品/治理）侧已经依赖的 engine 公开能力，与上层希望 engine 提供但当前未提供的接口诉求。

## 1. 目的

这份文档**只面向 `neptune-engine` 团队**（当前在 `~/.codex/worktrees/9536/neptune-lab` 分支推进解耦）。它解决一个具体问题：上层在做"诚实化产品"时遇到了 engine 公开 API 不支持的场景，需要 engine 团队评估并提供新的接口，而不是上层在产品层"假装"。

**重要边界**：
- 上层**不修改 `neptune-engine/`**（每个 PR `git diff | grep neptune-engine` 必须为空）
- 这份文档不是设计指令，是对接点清单
- engine 团队保留 API 设计自由度，只要满足上层的**语义需求**

## 2. 当前已依赖的 engine 公开 API（不需修改）

| 能力 | engine API | 上层使用方 |
| --- | --- | --- |
| 创建 Engine 实例 | `AgentEngine.create(config, runtime)` | `engine-factory.ts:107` |
| 创建/复用 Session | `engine.createSession({workspace})` | `engine-factory.ts:131` |
| 单次查询流 | `async* engine.query(sessionId, input: string, options)` | `thread-manager.ts:535` 的 dispatch 链 |
| 监听 query usage | `engine.on('query:complete', payload)` | `thread-manager.ts:540` 收集 token 用量 |
| 注入权限委托 | `extensions.permissions.delegate: PermissionDelegate` | `engine-factory.ts:77` 的 `TenantPermissionDelegate` |
| 注入 Skills | `extensions.skills: SkillExtension[]` | `engine-factory.ts:114` |
| memoryRoot 隔离 | `memoryRoot: string` | `engine-factory.ts:113` 的租户级目录 |

## 3. 上层撞墙清单（按紧迫度倒序）

### 3.1 AskUserQuestion 异步回写（高紧迫，已撞墙）

**场景**：LLM 在 query 流中调用 `AskUserQuestion` 工具，用户在前端选择答案后，上层希望把答案作为 `tool_result` 回灌给 LLM，让其继续推理。

**当前事实**：
- `routes/threads.ts:648` POST `/agents/:id/threads/:tid/reply` 接收答案后只能 log + 返回 202
- `AgentEngine.query(sessionId, input: string, options)` 第二参数仅接受 string，不接受 `tool_result` block
- `QueryOptions` 无 tool_result 注入入口
- `EventBus` 不暴露反向写入通道
- engine 内置 `AskUserQuestionTool` 是为 Claude Code TUI 设计的同进程交互——LLM 调用后 TUI 阻塞等用户终端选择，再用 answers 跑 `mapToolResultToToolResultBlockParam` 回灌——**不跨越 engine/host 进程边界**

**对上层的影响**：
- 用户在前端按"提交回答"实际不进入下一轮推理
- e2e `advanced-chat.spec.ts` 通过仅因为 controlled engine mock 不真等
- 生产环境（anthropic provider）下，AskUserQuestion 工具被 LLM 调用后会立刻执行 `call({answers: {}})`，answers 是空——LLM 拿到空答案后继续推理，**用户的选择被吞**

**当前上层降级方案**（同 PR 落地）：
- `QuestionBlock` 渲染只读卡片，不显示"提交回答"按钮
- 卡片下方显式提示"当前为预览展示，回答暂不进入下一轮推理（等待 engine 接口落地）"
- e2e 同步调整断言

**期望 engine 提供的接口**（任一）：

**方案 A — 显式注入 tool_result**

```ts
class AgentEngine {
  /** 把 host 收集到的 tool_result 注入指定 session 的下一轮推理上下文 */
  async submitToolResult(
    sessionId: string,
    toolUseId: string,
    content: string | ToolResultBlock,
  ): Promise<void>;
}
```

调用语义：当 query 流因等待 host-handled 工具（如 AskUserQuestion）而暂停时，host 调用此方法后，engine 在下一次同 session 的 query 触发或自动恢复。

**方案 B — query 接受 reply input 类型**

```ts
type QueryInput =
  | string
  | { type: 'continue_with_tool_result'; toolUseId: string; content: string };

async* query(sessionId: string, input: QueryInput, options?: QueryOptions);
```

**方案 C — Promise 异步钩子**

```ts
interface AskUserQuestionHandler {
  resolveAnswers(toolUseId: string, questions: Question[]): Promise<Record<string, string>>;
}

const engine = AgentEngine.create({
  extensions: {
    askUserQuestion: { handler: hostAskHandler },
  },
}, runtime);
```

engine 内部 `AskUserQuestionTool.call()` 改为 `await handler.resolveAnswers(...)`，host 端实现该 promise 等待前端 reply API 调用后 resolve。

**上层倾向**：方案 C 最干净——engine 内部仍然能用既有的 `mapToolResultToToolResultBlockParam` 把 answers 翻译成 tool_result，上层只需要实现一个 promise 等待器。但 engine 团队可按实际架构选择。

### 3.2 ToolInvocation 标准化事件（中紧迫，未撞墙但即将撞墙）

**场景**：上层 `ToolInvocation` 表已建好（`schema.ts`），治理台 Run detail 时间线展示工具调用。当前数据写入散落在 thread-manager 的 SSE 事件解析里，按推断写入。

**期望 engine 提供**：在工具开始/结束时显式触发标准事件 payload：

```ts
engine.on('tool:invocation:started', (payload: {
  sessionId: string;
  toolUseId: string;
  toolName: string;
  argsHash: string;       // sha256 of args JSON
}) => void);

engine.on('tool:invocation:completed', (payload: {
  sessionId: string;
  toolUseId: string;
  status: 'completed' | 'failed' | 'denied';
  resultHash: string;
  durationMs: number;
  error?: string;
}) => void);
```

**当前不阻塞**——上层用 SSE 事件流自己拼。但 engine 团队若有意标准化，请通知。

### 3.3 Token 使用预估钩子（低紧迫，远期）

**场景**：上层 quota gate 当前在 dispatch 前按租户级 token quota 预拦截，但**逐次调用前的实际 token 估算**做不到——engine 内部清楚 prompt + tools + history 的精确 token，host 不清楚。

**期望 engine 提供**：

```ts
interface QueryOptions {
  /** 在 LLM 调用前回调，返回 false 则取消该次调用 */
  onBeforeModelCall?: (estimate: {
    sessionId: string;
    inputTokens: number;
    estimatedOutputTokens: number;
    model: string;
  }) => Promise<boolean>;
}
```

**当前不阻塞**——上层按 daily token quota 拦截已足够 MVP。但 enterprise 用户要求 per-call quota 时会撞墙。

## 4. 9536 落地接口后上层要做的事

当 9536 提供 §3.1 任一方案后，上层将：

1. 移除 `QuestionBlock` 的"预览展示"降级提示
2. 恢复"提交回答"按钮
3. 把 `routes/threads.ts:/reply` 接通到 engine 新 API
4. 写 e2e：用 anthropic 或 controlled provider 验证 LLM 真的能接收到 answers 并继续推理
5. 删除本文档 §3.1 章节

## 5. 沟通协议

- **9536 团队的反馈通道**：在本仓 GitHub Issue 用 `engine-contract` 标签提
- **上层新增撞墙诉求**：直接编辑本文档 §3，提 PR 走 develop 评审
- **engine 接口实现进度**：9536 团队在自己仓的对应 issue 更新；本文档不跟踪进度

## 6. 边界声明

本文档**不规定** `neptune-engine` 的内部实现、文件组织、依赖图、测试策略。这些是 9536 团队的设计自由。本文档**只声明 engine 公开 API 应满足的语义**。
