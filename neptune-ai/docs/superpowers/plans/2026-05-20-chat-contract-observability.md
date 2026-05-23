# Chat 契约统一与可观测闭环 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立 Neptune AI 的 Chat Turn Contract，让 Server、Web、SSE、日志、Langfuse 和测试围绕同一组共享类型与 requestId 运转。

**Architecture:** 在根目录 `shared/types/neptune-ai` 新增纯类型契约 Module。Server 负责把 DB/Engine SDK events 映射到共享 wire event；Web 负责把共享 wire event 映射到 UI state。Chat route 生成 `ChatRequestContext`，贯穿 SSE、ThreadManager、events.jsonl 和 Langfuse。

**Tech Stack:** TypeScript ESM, Bun, Fastify, React/Vite, Playwright, Langfuse, `bun:test`.

---

## 文件结构

### 新增共享契约

- Create: `shared/types/neptune-ai/api/common.ts`
  - API error envelope、分页 meta、ISO 时间字符串。
- Create: `shared/types/neptune-ai/api/agents.ts`
  - Agent DTO、创建/更新请求、stats/document/thread summary DTO。
- Create: `shared/types/neptune-ai/api/threads.ts`
  - Thread DTO、ThreadStatus、thread API request/response DTO。
- Create: `shared/types/neptune-ai/api/chat-events.ts`
  - SSE wire events：connected/message/done/error 及业务事件 union。
- Create: `shared/types/neptune-ai/chat/view.ts`
  - ChatMessage/MessageBlock/PlanTask 等展示契约。
- Create: `shared/types/neptune-ai/observability.ts`
  - `ChatRequestContext` 与 trace metadata。
- Create: `shared/types/neptune-ai/index.ts`
  - 统一导出。

### Server 改造

- Modify: `neptune-ai/server/tsconfig.json`
  - 增加 `@shared/neptune-ai/*` path alias。
- Modify: `neptune-ai/server/src/services/sse-event-mapper.ts`
  - 删除本地重复 SSE 类型，改用 shared 类型。
  - 正式包含 `artifact` event。
- Modify: `neptune-ai/server/src/services/plan/types.ts`
  - Plan SSE 类型改为复用 shared 类型。
- Modify: `neptune-ai/server/src/routes/threads.ts`
  - chat route 生成 requestId。
  - `X-Request-Id` header 与 SSE connected/done/error payload 携带 requestId。
  - `events.jsonl` 写入 request metadata。
  - route 使用 dispatch terminal event，而不是 `threadManager.getLastUsage()`。
- Modify: `neptune-ai/server/src/services/thread-manager.ts`
  - `dispatch(threadId, content, context?)` 接收 `ChatRequestContext`。
  - usage 使用局部变量并 yield `dispatch_done`。
  - chat dispatch 创建请求级 tracing provider。
- Modify: `neptune-ai/server/src/services/observability/index.ts`
  - 新增 `createTracingProviderForRequest()`。
- Modify: `neptune-ai/server/src/services/observability/tracing-event-processor.ts`
  - metadata 接入 requestId。

### Web 改造

- Modify: `neptune-ai/web/tsconfig.json`
  - 增加 `@shared/neptune-ai/*` path alias。
- Modify: `neptune-ai/web/vite.config.ts`
  - 增加 `@shared/neptune-ai` alias。
- Modify: `neptune-ai/web/src/types/chat.ts`
  - 改为 re-export shared view/API 类型，保留本地兼容导出。
- Modify: `neptune-ai/web/src/api/threads.ts`
  - `SSECallbacks.onEvent` 改为 `ChatStreamEvent`。
  - parser 输出共享 event。
  - error/done/connected payload 使用共享类型。
- Modify: `neptune-ai/web/src/hooks/useChatMessages.ts`
  - 按共享 event union 分支处理。
  - 处理 `plan_step.status === 'failed'` 和 `tool_status.status === 'error'`。

### 测试

- Create: `neptune-ai/server/test/chat-contract.test.ts`
  - 验证 mapper 输出 shared event shape。
  - 验证 artifact/plan/tool error status。
- Create: `neptune-ai/server/test/chat-request-context.test.ts`
  - 验证 chat route connected/done/error requestId。
  - 验证 usage 不从 `lastUsage` 全局读取。
- Create: `neptune-ai/server/test/observability-request-context.test.ts`
  - fake Langfuse client 验证两个 provider 实例不共享 trace state。
- Create or Modify: `neptune-ai/web/src/api/threads.test.ts`
  - 验证 SSE parser 对 message/done/error 的解析。

## Task 1: 建立 shared Chat/API/Observability 契约

**Files:**
- Create: `shared/types/neptune-ai/api/common.ts`
- Create: `shared/types/neptune-ai/api/agents.ts`
- Create: `shared/types/neptune-ai/api/threads.ts`
- Create: `shared/types/neptune-ai/api/chat-events.ts`
- Create: `shared/types/neptune-ai/chat/view.ts`
- Create: `shared/types/neptune-ai/observability.ts`
- Create: `shared/types/neptune-ai/index.ts`

- [ ] **Step 1: 创建 API 通用类型**

Create `shared/types/neptune-ai/api/common.ts`:

```ts
export type IsoDateString = string;

export interface PaginationMeta {
  count: number;
  limit: number;
  offset: number;
  include?: string;
}

export interface ApiErrorEnvelope {
  error: string;
  message: string;
  requestId?: string;
  details?: Record<string, unknown>;
}

export interface ListResponse<T> {
  data: T[];
  meta: PaginationMeta;
}
```

- [ ] **Step 2: 创建 Chat 展示契约**

Create `shared/types/neptune-ai/chat/view.ts`:

```ts
export type PlanTaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface PlanTask {
  id: string;
  subject: string;
  description: string;
  activeForm?: string;
  owner?: string;
  status: PlanTaskStatus;
  blocks: string[];
  blockedBy: string[];
}

export interface BackgroundTask {
  id: string;
  type: 'local_bash' | 'local_agent' | 'remote_agent' | 'local_workflow';
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'killed';
  startTime: number;
  endTime?: number;
  summary?: string;
}

export interface AskUserQuestion {
  question: string;
  header?: string;
  options: Array<{ label: string; description?: string }>;
  multiSelect?: boolean;
}

export interface PlanTodo {
  content: string;
  status: PlanTaskStatus;
  activeForm?: string;
}

export type MessageBlock =
  | { type: 'thinking'; content: string; duration?: number }
  | { type: 'text'; content: string }
  | { type: 'tool_use'; id: string; name: string; input?: Record<string, unknown>; status: 'running' | 'completed' | 'error' }
  | { type: 'tool_result'; toolUseId: string; output?: Record<string, unknown>; isError?: boolean }
  | { type: 'artifact'; id: string; title: string; fileType: string; content: string }
  | { type: 'ask_user'; id: string; questions: AskUserQuestion[]; answered?: boolean; answers?: Record<string, string> }
  | { type: 'plan'; id: string; todos: PlanTodo[] };

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  blocks: MessageBlock[];
  status: 'streaming' | 'complete';
  createdAt?: string;
}
```

- [ ] **Step 3: 创建 Chat SSE wire event 契约**

Create `shared/types/neptune-ai/api/chat-events.ts`:

```ts
import type {ApiErrorEnvelope} from './common';
import type {AskUserQuestion, PlanTaskStatus} from '../chat/view';

export interface ChatConnectedEvent {
  type: 'connected';
  requestId: string;
  threadId: string;
  timestamp: number;
}

export interface ChatTextEvent {
  type: 'text';
  content: string;
  isDelta?: boolean;
  requestId?: string;
}

export interface ChatThinkingEvent {
  type: 'thinking';
  content: string;
  isDelta?: boolean;
  requestId?: string;
}

export interface ChatToolUseEvent {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: 'running' | 'completed' | 'error';
  requestId?: string;
}

export interface ChatToolResultEvent {
  type: 'tool_result';
  toolUseId: string;
  output: unknown;
  isError?: boolean;
  requestId?: string;
}

export interface ChatToolStatusEvent {
  type: 'tool_status';
  id: string;
  status: 'running' | 'completed' | 'error';
  requestId?: string;
}

export interface ChatAskUserEvent {
  type: 'ask_user';
  id: string;
  questions: AskUserQuestion[];
  requestId?: string;
}

export interface ChatArtifactEvent {
  type: 'artifact';
  id: string;
  title: string;
  fileType: string;
  content: string;
  requestId?: string;
}

export interface ChatPlanCreatedEvent {
  type: 'plan_created';
  planId: string;
  title: string;
  totalSteps: number;
  createdAt: string;
  requestId?: string;
}

export interface ChatPlanStepEvent {
  type: 'plan_step';
  planId: string;
  stepId: string;
  stepNumber: number;
  subject: string;
  status: PlanTaskStatus;
  activeForm?: string;
  updatedAt: string;
  requestId?: string;
}

export interface ChatPlanDoneEvent {
  type: 'plan_done';
  planId: string;
  status: 'completed' | 'failed';
  summary?: string;
  duration: number;
  completedAt: string;
  requestId?: string;
}

export interface ChatDoneEvent {
  type: 'done';
  requestId: string;
  usage?: Record<string, unknown>;
}

export interface ChatErrorEvent extends ApiErrorEnvelope {
  type: 'error';
  requestId: string;
}

export type ChatMessageEvent =
  | ChatTextEvent
  | ChatThinkingEvent
  | ChatToolUseEvent
  | ChatToolResultEvent
  | ChatToolStatusEvent
  | ChatAskUserEvent
  | ChatArtifactEvent
  | ChatPlanCreatedEvent
  | ChatPlanStepEvent
  | ChatPlanDoneEvent;

export type ChatStreamEvent =
  | ChatConnectedEvent
  | ChatMessageEvent
  | ChatDoneEvent
  | ChatErrorEvent;

export type ChatSseEventName = 'connected' | 'message' | 'done' | 'error';
```

- [ ] **Step 4: 创建 Thread/Agent DTO 契约**

Create `shared/types/neptune-ai/api/threads.ts`:

```ts
import type {IsoDateString, ListResponse} from './common';
import type {ChatMessage, PlanTask} from '../chat/view';

export type ThreadStatus = 'created' | 'running' | 'idle' | 'completed' | 'error';

export interface ThreadDto {
  id: string;
  tenantId: string;
  userId: string;
  templateId: string;
  status: ThreadStatus;
  title: string | null;
  summary: string | null;
  workspace: string;
  lastActiveAt: IsoDateString | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export type ListThreadsResponse = ListResponse<ThreadDto>;

export interface CreateThreadRequest {
  title?: string;
}

export interface UpdateThreadRequest {
  title?: string;
  status?: ThreadStatus;
}

export interface ThreadHistoryResponse {
  data: ChatMessage[];
  meta: Record<string, unknown>;
}

export interface ReplyToQuestionRequest {
  toolUseId: string;
  answers: Record<string, string>;
}

export interface ThreadTasksResponse {
  data: PlanTask[];
}
```

Create `shared/types/neptune-ai/api/agents.ts`:

```ts
import type {IsoDateString} from './common';

export interface AgentThreadSummaryDto {
  totalThreads: number;
  latestStatus: 'running' | 'idle' | 'completed' | 'error' | null;
  latestThreadTitle: string | null;
  lastActiveAt: IsoDateString | null;
}

export interface AgentTemplateDto {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  icon: string;
  systemPrompt: string;
  promptConfig?: Record<string, unknown> | null;
  modelConfig: {
    provider: string;
    model: string;
    temperature: number;
    maxTokens: number;
  };
  tools: string[];
  skills: Array<{ id: string; name: string; version?: string }>;
  mcpServers: Array<{ name: string; url: string; authConfig?: Record<string, unknown> }>;
  constraints: {
    maxTokensPerTurn?: number;
    maxTurnsPerSession?: number;
    maxConcurrentSessions?: number;
  };
  version: number;
  isActive: boolean;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  threadSummary?: AgentThreadSummaryDto | null;
}

export interface CreateAgentRequest {
  name: string;
  systemPrompt: string;
  modelConfig: AgentTemplateDto['modelConfig'];
  description?: string | null;
  icon?: string;
}

export type UpdateAgentRequest = Partial<Omit<CreateAgentRequest, 'name'>> & {
  name?: string;
};
```

- [ ] **Step 5: 创建 Observability 契约和统一导出**

Create `shared/types/neptune-ai/observability.ts`:

```ts
export interface ChatRequestContext {
  requestId: string;
  tenantId: string;
  userId: string;
  agentId: string;
  threadId: string;
  sdkSessionId?: string;
  model?: string;
}

export interface ChatTraceMetadata extends ChatRequestContext {
  durationMs?: number;
  traceId?: string;
  traceUrl?: string;
}
```

Create `shared/types/neptune-ai/index.ts`:

```ts
export * from './api/common';
export * from './api/agents';
export * from './api/threads';
export * from './api/chat-events';
export * from './chat/view';
export * from './observability';
```

- [ ] **Step 6: 静态检查共享类型**

Run:

```bash
bunx tsc --noEmit --allowImportingTsExtensions --moduleResolution bundler --module ESNext --target ES2022 shared/types/neptune-ai/index.ts
```

Expected:

```text
无 TypeScript 编译错误
```

## Task 2: 接通 Server/Web 对 shared 契约的 type-only import

**Files:**
- Modify: `neptune-ai/server/tsconfig.json`
- Modify: `neptune-ai/web/tsconfig.json`
- Modify: `neptune-ai/web/vite.config.ts`

- [ ] **Step 1: Server tsconfig 增加 alias**

Modify `neptune-ai/server/tsconfig.json` paths:

```json
"paths": {
  "@/*": ["src/*"],
  "@shared/neptune-ai": ["../../shared/types/neptune-ai/index.ts"],
  "@shared/neptune-ai/*": ["../../shared/types/neptune-ai/*"]
}
```

- [ ] **Step 2: Web tsconfig 增加 alias**

Modify `neptune-ai/web/tsconfig.json` paths:

```json
"paths": {
  "@/*": ["./*"],
  "@shared/neptune-ai": ["../../shared/types/neptune-ai/index.ts"],
  "@shared/neptune-ai/*": ["../../shared/types/neptune-ai/*"]
}
```

- [ ] **Step 3: Vite 增加 alias**

Modify `neptune-ai/web/vite.config.ts` alias:

```ts
alias: {
  '@': path.resolve(__dirname, '.'),
  '@shared/neptune-ai': path.resolve(__dirname, '../../shared/types/neptune-ai/index.ts'),
},
```

- [ ] **Step 4: 运行最窄 typecheck**

Run:

```bash
cd neptune-ai/web
bun run lint
```

Expected:

```text
无 TypeScript 编译错误
```

Run:

```bash
cd neptune-ai/server
bun test test/permission-delegate.test.ts
```

Expected:

```text
测试通过
```

## Task 3: Server SSE mapper 改用 shared ChatStreamEvent

**Files:**
- Modify: `neptune-ai/server/src/services/sse-event-mapper.ts`
- Modify: `neptune-ai/server/src/services/plan/types.ts`
- Test: `neptune-ai/server/test/chat-contract.test.ts`

- [ ] **Step 1: 写 mapper 契约测试**

Create `neptune-ai/server/test/chat-contract.test.ts`:

```ts
import {describe, expect, test} from 'bun:test';
import {mapSSEEvent} from '../src/services/sse-event-mapper';
import type {ChatStreamEvent} from '../../../shared/types/neptune-ai';

function assertChatEvent(event: ChatStreamEvent): ChatStreamEvent {
  return event;
}

describe('chat contract', () => {
  test('maps text delta to shared text event', () => {
    const [event] = mapSSEEvent({
      type: 'stream_event',
      event: {
        type: 'content_block_delta',
        delta: {type: 'text_delta', text: 'hello'},
      },
    });

    const typed = assertChatEvent(event);
    expect(typed.type).toBe('text');
    if (typed.type === 'text') {
      expect(typed.content).toBe('hello');
      expect(typed.isDelta).toBe(true);
    }
  });

  test('maps tool result error to shared tool status error', () => {
    const events = mapSSEEvent({
      type: 'tool_result',
      toolUseId: 'tool-1',
      output: {message: 'denied'},
      isError: true,
    });

    expect(events.some(event => event.type === 'tool_result')).toBe(true);
    expect(events).toContainEqual({
      type: 'tool_status',
      id: 'tool-1',
      status: 'error',
    });
  });

  test('accepts artifact as shared chat event', () => {
    const event: ChatStreamEvent = {
      type: 'artifact',
      id: 'artifact-1',
      title: 'report.md',
      fileType: '.md',
      content: '# Report',
    };

    expect(event.type).toBe('artifact');
  });
});
```

- [ ] **Step 2: 运行测试确认当前失败或类型暴露漂移**

Run:

```bash
cd neptune-ai/server
bun test test/chat-contract.test.ts
```

Expected:

```text
当前可能因 shared alias/类型不匹配失败
```

- [ ] **Step 3: 修改 mapper 类型导入**

Modify `neptune-ai/server/src/services/sse-event-mapper.ts`:

```ts
import type {
  ChatAskUserEvent,
  ChatMessageEvent,
  ChatPlanCreatedEvent,
  ChatPlanDoneEvent,
  ChatPlanStepEvent,
  ChatStreamEvent,
  ChatTextEvent,
  ChatThinkingEvent,
  ChatToolResultEvent,
  ChatToolStatusEvent,
  ChatToolUseEvent,
} from '@shared/neptune-ai';
```

Delete local duplicate `SSE*Event` interfaces and replace:

```ts
export type SSEEvent = ChatStreamEvent;
export type SSEPlanCreatedEvent = ChatPlanCreatedEvent;
export type SSEPlanStepEvent = ChatPlanStepEvent;
export type SSEPlanDoneEvent = ChatPlanDoneEvent;
export type SSEPlanEvent = ChatPlanCreatedEvent | ChatPlanStepEvent | ChatPlanDoneEvent;
```

Keep `mapSSEEvent()` return type as:

```ts
export function mapSSEEvent(sdkEvent: Record<string, unknown>): ChatMessageEvent[] {
```

- [ ] **Step 4: 修正 tool_result error status**

In `mapSSEEvent`, ensure `tool_result` emits:

```ts
{
  type: 'tool_status',
  id: toolUseId,
  status: isError ? 'error' : 'completed',
}
```

- [ ] **Step 5: Plan types 复用 shared**

Modify `neptune-ai/server/src/services/plan/types.ts`:

```ts
import type {
  ChatPlanCreatedEvent as SSEPlanCreatedEvent,
  ChatPlanDoneEvent as SSEPlanDoneEvent,
  ChatPlanStepEvent as SSEPlanStepEvent,
  PlanTaskStatus as StepStatus,
} from '@shared/neptune-ai';

export type {SSEPlanCreatedEvent, SSEPlanDoneEvent, SSEPlanStepEvent, StepStatus};
export type PlanStatus = 'active' | 'completed' | 'failed';
export type SSEPlanEvent = SSEPlanCreatedEvent | SSEPlanStepEvent | SSEPlanDoneEvent;
```

Keep `Plan`, `PlanStep`, `TaskCreateInput`, `TaskUpdateInput`, `SDKToolUseEvent` as server-local implementation types.

- [ ] **Step 6: 运行契约测试**

Run:

```bash
cd neptune-ai/server
bun test test/chat-contract.test.ts test/plan-manager.test.ts
```

Expected:

```text
所有测试通过
```

## Task 4: Web SSE parser 与 chat types 改用 shared 契约

**Files:**
- Modify: `neptune-ai/web/src/types/chat.ts`
- Modify: `neptune-ai/web/src/api/threads.ts`
- Modify: `neptune-ai/web/src/hooks/useChatMessages.ts`

- [ ] **Step 1: Re-export shared chat/view 类型**

Modify `neptune-ai/web/src/types/chat.ts` top-level exports:

```ts
export type {
  AgentTemplateDto as AgentTemplate,
  AgentThreadSummaryDto as AgentThreadSummary,
  AgentTemplateDto as AgentWithSummary,
  AskUserQuestion,
  BackgroundTask,
  ChatMessage,
  MessageBlock,
  PlanTask,
  PlanTodo,
  ThreadDto as Thread,
} from '@shared/neptune-ai';

export type ThreadStatus = 'idle' | 'running' | 'completed' | 'error';
```

Keep `isCurrentThread()` and `isBackendThread()` functions.

- [ ] **Step 2: 修改 SSE callback 类型**

Modify `neptune-ai/web/src/api/threads.ts`:

```ts
import type {
  ChatDoneEvent,
  ChatErrorEvent,
  ChatMessageEvent,
  ChatStreamEvent,
  ThreadDto as Thread,
} from '@shared/neptune-ai';
```

Replace `SSECallbacks`:

```ts
export interface SSECallbacks {
  onEvent: (event: ChatMessageEvent) => void;
  onError?: (error: Error, event?: ChatErrorEvent) => void;
  onDone?: (event?: ChatDoneEvent) => void;
  onConnected?: (event: Extract<ChatStreamEvent, {type: 'connected'}>) => void;
}
```

- [ ] **Step 3: 修改 parser 分发**

In `sendThreadMessage`, when parsing SSE:

```ts
if (currentEvent === 'done') {
  callbacks.onDone?.({type: 'done', ...(parsed as Omit<ChatDoneEvent, 'type'>});
} else if (currentEvent === 'error') {
  const event = {type: 'error', ...(parsed as Omit<ChatErrorEvent, 'type'>)} as ChatErrorEvent;
  callbacks.onError?.(new Error(event.message || 'SSE error'), event);
} else if (currentEvent === 'message') {
  callbacks.onEvent(parsed as ChatMessageEvent);
} else if (currentEvent === 'connected') {
  callbacks.onConnected?.({type: 'connected', ...(parsed as Omit<Extract<ChatStreamEvent, {type: 'connected'}>, 'type'>)});
}
```

- [ ] **Step 4: 修正 hook 对 failed/error 状态的处理**

Modify `neptune-ai/web/src/hooks/useChatMessages.ts`:

For `tool_status`:

```ts
const status = (data as {status?: 'running' | 'completed' | 'error'}).status || 'completed';
```

For `plan_step`, preserve failed:

```ts
status: (status || 'pending') as PlanTask['status'],
```

- [ ] **Step 5: 运行 Web typecheck**

Run:

```bash
cd neptune-ai/web
bun run lint
```

Expected:

```text
无 TypeScript 编译错误
```

## Task 5: Chat requestId 贯穿 SSE 与 events.jsonl

**Files:**
- Modify: `neptune-ai/server/src/routes/threads.ts`
- Modify: `neptune-ai/server/src/services/thread-manager.ts`
- Test: `neptune-ai/server/test/chat-request-context.test.ts`

- [ ] **Step 1: 写 requestId 测试**

Create `neptune-ai/server/test/chat-request-context.test.ts` with a focused helper test for payload shape:

```ts
import {describe, expect, test} from 'bun:test';
import type {ChatConnectedEvent, ChatDoneEvent, ChatErrorEvent} from '../../../shared/types/neptune-ai';

describe('chat request context contract', () => {
  test('connected done and error events carry requestId', () => {
    const connected: ChatConnectedEvent = {
      type: 'connected',
      requestId: 'req_123',
      threadId: 'thread_1',
      timestamp: 1,
    };
    const done: ChatDoneEvent = {
      type: 'done',
      requestId: 'req_123',
      usage: {},
    };
    const error: ChatErrorEvent = {
      type: 'error',
      error: 'QUERY_ERROR',
      message: 'failed',
      requestId: 'req_123',
    };

    expect(connected.requestId).toBe(done.requestId);
    expect(error.requestId).toBe(done.requestId);
  });
});
```

- [ ] **Step 2: Chat route 生成 requestId**

In `neptune-ai/server/src/routes/threads.ts`, import:

```ts
import {randomUUID} from 'crypto';
import type {ChatConnectedEvent, ChatDoneEvent, ChatErrorEvent, ChatRequestContext} from '@shared/neptune-ai';
```

Inside chat route after validation:

```ts
const requestId = randomUUID();
reply.header('X-Request-Id', requestId);
```

- [ ] **Step 3: connected payload 携带 requestId**

Replace connected write:

```ts
const connectedEvent: ChatConnectedEvent = {
  type: 'connected',
  requestId,
  threadId,
  timestamp: Date.now(),
};
reply.raw.write(`event: connected\ndata: ${JSON.stringify(connectedEvent)}\n\n`);
```

- [ ] **Step 4: 构造 ChatRequestContext 并传入 dispatch**

Before dispatch:

```ts
const chatContext: ChatRequestContext = {
  requestId,
  tenantId: user.tenantId,
  userId: user.userId,
  agentId,
  threadId,
};
```

Call:

```ts
const stream = threadManager.dispatch(threadId, content, chatContext);
```

- [ ] **Step 5: events.jsonl 写入 request metadata**

Replace user persist:

```ts
persistEvent({_meta: 'request', requestId, threadId, agentId, tenantId: user.tenantId, userId: user.userId});
persistEvent({_role: 'user', requestId, content});
```

- [ ] **Step 6: done/error payload 携带 requestId**

For done:

```ts
const doneEvent: ChatDoneEvent = {type: 'done', requestId, usage: usage || {}};
reply.raw.write(`event: done\ndata: ${JSON.stringify(doneEvent)}\n\n`);
```

For error:

```ts
const errorEvent: ChatErrorEvent = {
  type: 'error',
  error: 'QUERY_ERROR',
  message: String(error),
  requestId,
};
reply.raw.write(`event: error\ndata: ${JSON.stringify(errorEvent)}\n\n`);
```

- [ ] **Step 7: 运行 server chat tests**

Run:

```bash
cd neptune-ai/server
bun test test/chat-request-context.test.ts test/controlled-engine-chat.test.ts
```

Expected:

```text
所有测试通过；controlled chat 如依赖 Docker 需在本地服务运行时执行
```

## Task 6: Usage 从 ThreadManager 全局状态局部化

**Files:**
- Modify: `neptune-ai/server/src/services/thread-manager.ts`
- Modify: `neptune-ai/server/src/routes/threads.ts`
- Test: `neptune-ai/server/test/thread-manager.test.ts`

- [ ] **Step 1: 定义 dispatch terminal event**

In `thread-manager.ts`, add local type:

```ts
interface DispatchDoneEvent {
  type: 'dispatch_done';
  usage?: QueryUsageResult;
}

type ThreadDispatchEvent = Record<string, unknown> | DispatchDoneEvent;
```

Change dispatch signature:

```ts
async *dispatch(threadId: string, content: string, requestContext?: ChatRequestContext): AsyncGenerator<ThreadDispatchEvent>
```

- [ ] **Step 2: 局部 usage 替代 lastUsage**

Inside dispatch:

```ts
let dispatchUsage: QueryUsageResult | undefined;
```

In `query:complete`:

```ts
dispatchUsage = payload as QueryUsageResult;
this.lastUsage = dispatchUsage;
```

Keep `lastUsage` temporarily for backward compatibility, but route must stop using it.

- [ ] **Step 3: dispatch 完成前 yield done**

After trace end and before transcript persist or right after status update:

```ts
yield {type: 'dispatch_done', usage: dispatchUsage};
```

- [ ] **Step 4: route 捕获 dispatch_done**

In chat route loop:

```ts
if (eventType === 'dispatch_done') {
  usage = (sdkEvent as {usage?: unknown}).usage;
  continue;
}
```

Define route-local:

```ts
let usage: unknown = {};
```

Remove:

```ts
const usage = threadManager.getLastUsage();
```

- [ ] **Step 5: 运行 thread manager tests**

Run:

```bash
cd neptune-ai/server
bun test test/thread-manager.test.ts test/threads-chat.test.ts
```

Expected:

```text
测试通过；threads-chat 依赖本地 Docker 时需沙箱外运行
```

## Task 7: Langfuse request-scoped provider

**Files:**
- Modify: `neptune-ai/server/src/services/observability/index.ts`
- Modify: `neptune-ai/server/src/services/thread-manager.ts`
- Modify: `neptune-ai/server/src/services/observability/tracing-event-processor.ts`
- Test: `neptune-ai/server/test/observability-request-context.test.ts`

- [ ] **Step 1: 新增请求级 provider factory**

Modify `observability/index.ts`:

```ts
export function createTracingProviderForRequest(): ITracingProvider {
  if (langfuseInstance) {
    return new LangfuseTracingProvider(langfuseInstance);
  }
  return NoOpTracingProvider.getInstance();
}
```

- [ ] **Step 2: TracingProcessorConfig 增加 requestId**

Modify `tracing-event-processor.ts`:

```ts
requestId?: string;
```

In `setTraceContext` metadata:

```ts
metadata: {
  agentId: config.agentId,
  tenantId: config.tenantId,
  requestId: config.requestId,
},
```

- [ ] **Step 3: ThreadManager 使用请求级 provider**

Modify imports:

```ts
import {createTracingProviderForRequest} from './observability/index.js';
```

Replace:

```ts
const provider = getTracingProvider();
```

With:

```ts
const provider = createTracingProviderForRequest();
```

When constructing `TracingEventProcessor`, pass:

```ts
requestId: requestContext?.requestId,
```

- [ ] **Step 4: 写 request-scoped provider 测试**

Create `neptune-ai/server/test/observability-request-context.test.ts`:

```ts
import {describe, expect, test} from 'bun:test';
import {LangfuseTracingProvider} from '../src/services/observability/langfuse-tracing-provider';

function fakeLangfuse() {
  const traces: unknown[] = [];
  return {
    traces,
    trace(params: unknown) {
      traces.push(params);
      return {
        span() {
          return {span: this.span, generation: () => ({}), event: () => {}, end: () => {}};
        },
        generation: () => ({}),
        event: () => {},
        update: () => {},
      };
    },
  };
}

describe('request scoped langfuse provider', () => {
  test('two providers keep independent trace context', () => {
    const client = fakeLangfuse() as any;
    const first = new LangfuseTracingProvider(client);
    const second = new LangfuseTracingProvider(client);

    first.setTraceContext({name: 'query', sessionId: 't1', metadata: {requestId: 'r1'}});
    second.setTraceContext({name: 'query', sessionId: 't2', metadata: {requestId: 'r2'}});

    expect(client.traces).toHaveLength(2);
    expect(client.traces[0]).toMatchObject({sessionId: 't1', metadata: {requestId: 'r1'}});
    expect(client.traces[1]).toMatchObject({sessionId: 't2', metadata: {requestId: 'r2'}});
  });
});
```

- [ ] **Step 5: 运行 observability tests**

Run:

```bash
cd neptune-ai/server
bun test test/observability-request-context.test.ts
```

Expected:

```text
测试通过
```

## Task 8: 回归验证与报告更新

**Files:**
- Modify: `neptune-ai/docs/reports/2026-05-20-full-validation-report.md`
  - 追加本轮验证结果。

- [ ] **Step 1: 运行 Engine/Server 核心测试**

Run:

```bash
cd neptune-engine
bun test src/engine/cc-runtime/__tests__/CCRuntime.test.ts src/engine/cc-runtime/__tests__/headless-runtime.test.ts src/engine/__tests__/public-entrypoint.test.ts
```

Expected:

```text
测试通过
```

Run:

```bash
cd neptune-ai/server
bun test test/chat-contract.test.ts test/chat-request-context.test.ts test/observability-request-context.test.ts test/permission-delegate.test.ts test/engine-factory-permissions.test.ts
```

Expected:

```text
测试通过
```

- [ ] **Step 2: 运行 Web typecheck**

Run:

```bash
cd neptune-ai/web
bun run lint
```

Expected:

```text
测试通过
```

- [ ] **Step 3: 在本地服务可用时运行浏览器核心项目**

Run:

```bash
cd neptune-ai/web
bun run test -- --project=smoke --project=auth --project=controlled-chat --workers=1
```

Expected:

```text
核心浏览器测试通过
```

- [ ] **Step 4: 更新验证报告**

Append to `neptune-ai/docs/reports/2026-05-20-full-validation-report.md`:

```md
## Chat Contract 与 Observability 回归

- Shared contract: `shared/types/neptune-ai`
- Server contract tests: passed
- Web typecheck: passed
- RequestId propagation: connected/done/error payload covered
- Usage locality: chat route no longer reads `ThreadManager.lastUsage`
- Langfuse request scope: provider instance isolation covered
```

## Self-Review Checklist

- Spec coverage:
  - Shared contract：Task 1-4。
  - requestId：Task 5。
  - usage locality：Task 6。
  - Langfuse request scope：Task 7。
  - verification/report：Task 8。
- Placeholder scan:
  - 没有 `TBD`。
  - 没有“适当处理”类空泛步骤。
- Type consistency:
  - `ChatStreamEvent` 是总 union。
  - `ChatMessageEvent` 是 `event: message` payload union。
  - `ChatRequestContext` 位于 `shared/types/neptune-ai/observability.ts`。

