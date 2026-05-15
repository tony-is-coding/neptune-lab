# Langfuse 可观测性集成设计

## 背景

Neptune-AI Server 需要 LLM 调用可观测性和日志链路追踪。Neptune Engine 已内置 `ITracingProvider` / `IMetricsProvider` 接口体系，并在 query、session、tool 等关键路径自动埋点。Server 层只需实现这两个接口，注入 Engine 即可激活全链路可观测性。

## 目标

1. LLM 调用完整可观测（model、input/output、tokens、latency、cost）
2. 一个 query 请求跨模块用同一个 traceId 串联
3. 按 sessionId（threadId）、agentId、userId 维度筛选
4. 不侵入 Engine 代码，Server 层实现 Provider 并注入

## 架构

```
┌─────────────────────────────────────────────────────────────────┐
│ Neptune-AI Server                                               │
│                                                                 │
│  index.ts                                                       │
│    └─ 初始化 Langfuse client                                    │
│                                                                 │
│  server/src/services/observability/                              │
│  ├── langfuse-tracing-provider.ts  ← implements ITracingProvider│
│  ├── langfuse-metrics-provider.ts  ← implements IMetricsProvider│
│  └── index.ts                      ← 导出 + 初始化工厂         │
│                                                                 │
│  engine-factory.ts                                              │
│    └─ AgentEngine.create({                                      │
│         tracingProvider: langfuseTracingProvider,                │
│         metricsProvider: langfuseMetricsProvider,                │
│       })                                                        │
│                                                                 │
│  thread-manager.ts                                              │
│    └─ dispatch() 中创建 Langfuse trace（HTTP 层 + prompt 组装） │
│                                                                 │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTPS (async batch)
                               ▼
                      ┌─────────────────┐
                      │  Langfuse Cloud │
                      └─────────────────┘
```

## Engine 已有埋点（自动生效）

| 事件 | 类型 | 说明 |
|------|------|------|
| session.created | counter | createSession 调用 |
| session.destroyed | counter | destroySession 调用 |
| query.started | counter | query 开始 |
| query.failed | counter | query 异常 |
| tool.execution | counter | 工具调用开始（含按工具名细分） |
| tool.completed | counter | 工具调用完成（含按工具名细分） |

这些由 Engine 内部触发，注入 Provider 后自动上报。

## Server 额外埋点（Engine 不覆盖的）

| 事件 | 位置 | 说明 |
|------|------|------|
| http.request | index.ts onResponse hook | HTTP 请求耗时 + 状态码 |
| prompt.assembly | thread-manager.ts | Prompt 组装耗时 |
| engine.create | engine-factory.ts | Engine 创建耗时 |
| engine.evicted | thread-manager.ts | Pool 淘汰事件 |

## 核心实现

### 1. LangfuseTracingProvider

```typescript
import Langfuse from 'langfuse';
import type { ITracingProvider } from 'claude-code-best/engine';
import type { Span } from 'claude-code-best/engine';

export class LangfuseTracingProvider implements ITracingProvider {
  private langfuse: Langfuse;
  private currentTrace: LangfuseTrace | null = null;

  constructor(langfuse: Langfuse) {
    this.langfuse = langfuse;
  }

  /**
   * 设置当前 trace 上下文（dispatch 入口调用）
   */
  setTraceContext(params: {
    name: string;
    sessionId: string;  // = threadId
    userId?: string;
    metadata?: Record<string, unknown>;
  }): void {
    this.currentTrace = this.langfuse.trace({
      name: params.name,
      sessionId: params.sessionId,
      userId: params.userId,
      metadata: params.metadata,
    });
  }

  startSpan(name: string, attributes?: Record<string, unknown>): Span {
    // 如果有 trace 上下文，创建子 span
    const langfuseSpan = this.currentTrace
      ? this.currentTrace.span({ name, metadata: attributes })
      : null;

    return new LangfuseSpan(name, attributes, langfuseSpan);
  }

  runInSpan<T>(
    name: string,
    fn: (span: Span) => T,
    attributes?: Record<string, unknown>,
  ): T {
    const span = this.startSpan(name, attributes);
    try {
      const result = fn(span);
      span.setStatus(SpanStatus.OK);
      return result;
    } catch (error) {
      span.setStatus(SpanStatus.ERROR);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * 记录 LLM generation（Langfuse 核心能力）
   */
  generation(params: {
    name: string;
    model: string;
    input: unknown;
    output: unknown;
    usage: { inputTokens: number; outputTokens: number };
    latencyMs: number;
  }): void {
    if (!this.currentTrace) return;
    this.currentTrace.generation({
      name: params.name,
      model: params.model,
      input: params.input,
      output: params.output,
      usage: {
        input: params.usage.inputTokens,
        output: params.usage.outputTokens,
      },
      completionStartTime: new Date(Date.now() - params.latencyMs),
    });
  }

  /**
   * 结束当前 trace
   */
  endTrace(): void {
    this.currentTrace = null;
  }

  dispose(): void {
    this.langfuse.shutdownAsync();
  }
}
```

### 2. LangfuseMetricsProvider

```typescript
import type { IMetricsProvider, Counter, Gauge, Histogram, Timer } from 'claude-code-best/engine';

/**
 * Langfuse 不原生支持 metrics，用 InMemoryMetricsProvider 收集，
 * 定期通过 Langfuse score API 上报关键指标。
 * 
 * 或者直接用 NoOpMetricsProvider，metrics 暂不上报。
 * 第一版选择 NoOp，聚焦 tracing + generation。
 */
export { NoOpMetricsProvider as LangfuseMetricsProvider } from 'claude-code-best/engine';
```

### 3. 初始化工厂

```typescript
// server/src/services/observability/index.ts
import Langfuse from 'langfuse';
import { LangfuseTracingProvider } from './langfuse-tracing-provider';
import { NoOpTracingProvider } from 'claude-code-best/engine';

let langfuseInstance: Langfuse | null = null;
let tracingProvider: ITracingProvider;

export function initObservability(): void {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;

  if (publicKey && secretKey) {
    langfuseInstance = new Langfuse({
      publicKey,
      secretKey,
      baseUrl: process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com',
    });
    tracingProvider = new LangfuseTracingProvider(langfuseInstance);
  } else {
    // 未配置时静默降级为 NoOp
    tracingProvider = NoOpTracingProvider.getInstance();
  }
}

export function getTracingProvider(): ITracingProvider {
  return tracingProvider;
}

export async function shutdownObservability(): Promise<void> {
  if (langfuseInstance) {
    await langfuseInstance.shutdownAsync();
  }
}
```

### 4. Engine 注入点（engine-factory.ts 改动）

```typescript
// 在 createAndLoad() 中：
const engine = AgentEngine.create({
  systemPrompt: params.systemPrompt,
  memoryRoot: params.memoryRoot,
  tracingProvider: getTracingProvider(),   // ← 新增
  metricsProvider: getMetricsProvider(),   // ← 新增
  // ... 其他配置
});
```

### 5. Dispatch 入口埋点（thread-manager.ts 改动）

```typescript
// dispatch() 方法开头：
const provider = getTracingProvider();
if (provider instanceof LangfuseTracingProvider) {
  provider.setTraceContext({
    name: 'query',
    sessionId: threadId,    // Langfuse session = Neptune thread
    userId: thread.userId,
    metadata: { agentId, tenantId: thread.tenantId },
  });
}

// dispatch() 结束时：
if (provider instanceof LangfuseTracingProvider) {
  // 记录 LLM generation
  const usage = this.lastUsage;
  if (usage?.modelUsage) {
    const model = Object.keys(usage.modelUsage)[0];
    const modelUsage = Object.values(usage.modelUsage)[0];
    provider.generation({
      name: 'llm-call',
      model,
      input: content,
      output: '(streamed)',
      usage: {
        inputTokens: modelUsage.inputTokens,
        outputTokens: modelUsage.outputTokens,
      },
      latencyMs: durationMs,
    });
  }
  provider.endTrace();
}
```

## Langfuse 数据模型映射

```
┌──────────────────┬──────────────────────────────────────┐
│ Langfuse 概念    │ Neptune-AI 映射                       │
├──────────────────┼──────────────────────────────────────┤
│ Session          │ threadId（一个 thread = 一个 session）│
│ Trace            │ 一次 dispatch（一条用户消息）         │
│ Span             │ prompt-assembly / engine-create 等    │
│ Generation       │ LLM 调用（model + tokens + latency）  │
│ User             │ userId                                │
│ Metadata         │ { agentId, tenantId }                 │
└──────────────────┴──────────────────────────────────────┘
```

## 配置

```env
# .env.example 新增
LANGFUSE_PUBLIC_KEY=pk-lf-xxx        # Langfuse Cloud Public Key
LANGFUSE_SECRET_KEY=sk-lf-xxx        # Langfuse Cloud Secret Key
LANGFUSE_BASE_URL=https://cloud.langfuse.com  # 可选，默认值
```

未配置时自动降级为 NoOp，不影响正常运行。

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| server/src/services/observability/index.ts | 新建 | 初始化工厂 + 导出 |
| server/src/services/observability/langfuse-tracing-provider.ts | 新建 | ITracingProvider 的 Langfuse 实现 |
| server/src/services/engine-factory.ts | 修改 | 注入 tracingProvider |
| server/src/services/thread-manager.ts | 修改 | dispatch 入口设置 trace 上下文 + generation |
| server/src/index.ts | 修改 | 调用 initObservability() + shutdown hook |
| server/.env.example | 修改 | 新增 LANGFUSE_* 变量 |
| server/package.json | 修改 | 新增 langfuse 依赖 |

## 依赖

```bash
bun add langfuse
```

## 验证方案

1. 配置 Langfuse Cloud key，启动 dev server
2. 发送一条 chat 消息
3. 打开 Langfuse Cloud Dashboard 验证：
   - 出现一个 trace（name=query）
   - trace 下有 generation（含 model、tokens、latency）
   - session 维度能看到 threadId 聚合
   - metadata 包含 agentId、tenantId
4. 不配置 key 时，服务正常启动无报错（NoOp 降级）

## 未来扩展

- **Metrics → Prometheus**：实现 `PrometheusMetricsProvider`，注入 Engine
- **Prompt 版本管理**：利用 Langfuse 的 prompt management 功能
- **Evaluation**：利用 Langfuse score 做 Agent 输出质量评估
- **OTel 迁移**：实现 `OTelTracingProvider`，替换 Langfuse Provider，Engine 代码不动
