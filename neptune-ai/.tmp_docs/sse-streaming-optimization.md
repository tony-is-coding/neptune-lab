# SSE 流式输出优化方案

## 一、现状分析

### 1.1 架构现状

```
用户发送消息
  → POST /agents/:agentId/threads/:threadId/chat
  → ThreadManager.dispatch()
  → EnginePool.get() 或 创建新 Engine
  → AgentEngine.query(sessionId, content)
  → SDK 流式 yield 事件
  → mapSSEEvent() 映射
  → SSE 发送到前端
  → 前端 useChatMessages 解析
  → TextBlock 组件渲染
```

### 1.2 问题根因

#### 根因 1：SDK 事件映射丢失增量信息

**位置**：`server/src/services/sse-event-mapper.ts:117-121`

```typescript
case 'assistant': {
  const text = extractAssistantText(sdkEvent);
  if (!text) return [];
  return [{ type: 'text', content: text }];  // 整体返回！
}
```

**问题**：SDK 的 `assistant` 事件实际上包含增量内容，但 `extractAssistantText` 函数一次性提取全部文本，导致：
- 前端收到的已经是完整文本块
- 无法实现真正的逐字流式打印

#### 根因 2：前端打字动画是"假的"

**位置**：`web/src/components/chat/TextBlock.tsx:23-35`

```typescript
intervalRef.current = setInterval(() => {
  indexRef.current += 1;
  setDisplayedContent(content.slice(0, indexRef.current));
}, 20);  // 固定 20ms 间隔模拟打字
```

**问题**：
- 打字效果是前端 JavaScript 模拟的，不是基于真实 SSE 推送
- 用户感知是"等待很久 → 突然出现大段文本 → 然后开始打字动画"
- 真正的 TTFT（首 Token 时间）被隐藏在打字动画开始之前

#### 根因 3：Engine 创建开销

**位置**：`server/src/services/thread-manager.ts:392-404`

每次 dispatch 如果 pool 中没有 Engine，需要：
1. 创建 TenantPermissionDelegate（权限委托）
2. 调用 AgentEngine.create()（SDK 引擎创建）
3. 调用 engine.createSession()（SDK Session 创建）

这些操作是串行的，且涉及多个异步调用，导致首 Token 延迟。

### 1.3 用户体验痛点

1. **首 Token 时间（TTFT）过长**：用户点击发送后，等待 3-5 秒才开始看到任何响应
2. **流式感不强**：虽然前端有打字动画，但本质上是"等全部 → 打字播放"，不是真正的逐字输出
3. **长文本更明显**：Agent 回复越长，等待时间越久，用户焦虑感越强

---

## 二、解决方案

### 2.1 后端优化（Phase 1 - 真正的增量流式）

#### 方案 A：利用 SDK 的增量事件

**核心思路**：SDK 的 `callModel` 返回的是真正的流式响应，每个 `assistant` 事件可能只包含增量文本。

**实现**：

1. **修改 SSE 事件映射器**，支持增量文本事件：

```typescript
// server/src/services/sse-event-mapper.ts

export interface SSETextEvent {
  type: 'text';
  content: string;
  isDelta?: boolean;  // 新增：标识是否为增量
  isFinal?: boolean;  // 新增：标识是否为最终完成
}

case 'assistant': {
  const message = sdkEvent.message as Record<string, unknown>;
  if (message?.content && Array.isArray(message.content)) {
    const events: SSEEvent[] = [];

    for (const block of message.content) {
      if (block.type === 'text' && typeof block.text === 'string') {
        // SDK 可能会发送增量文本块
        events.push({
          type: 'text',
          content: block.text,
          isDelta: block.delta === true,  // SDK 增量标记
          isFinal: block.stop_reason !== undefined,
        });
      }
      // ... 处理其他 block 类型
    }

    return events;
  }
  return [];
}
```

2. **验证 SDK 是否真的发送增量**：需要实际测试 SDK 的流式行为。

**风险**：如果 SDK 的 `assistant` 事件本身就是累积的（而非增量），则需要方案 B。

#### 方案 B：后端主动切分文本（备选）

如果 SDK 不支持增量，可以在后端对文本进行智能切分：

```typescript
// 基于句子边界切分文本
function splitTextForStreaming(text: string): string[] {
  const sentences = text.match(/[^.!?。！？]+[.!?。！？]*/g) || [text];
  return sentences.filter(s => s.trim().length > 0);
}

// 在 mapSSEEvent 中
case 'assistant': {
  const text = extractAssistantText(sdkEvent);
  if (!text) return [];

  const chunks = splitTextForStreaming(text);
  return chunks.map((chunk, index) => ({
    type: 'text',
    content: chunk,
    isDelta: true,
    isFinal: index === chunks.length - 1,
  }));
}
```

**缺点**：需要等待完整响应才能切分，无法改善 TTFT。

### 2.2 后端优化（Phase 2 - TTFT 优化）

#### 优化 1：Engine 预热池

**思路**：为活跃 Agent 维护一个预热 Engine 池，提前创建好 Engine 实例。

**实现**：

```typescript
// server/src/services/engine-pool.ts

export class WarmEnginePool {
  private warmEngines: Map<string, DestroyableEngine> = new Map();

  // 为 Agent 预创建 Engine
  async warmup(agentId: string, template: AgentTemplate): Promise<void> {
    if (this.warmEngines.has(agentId)) return;

    const engine = await this.createEngine(template);
    this.warmEngines.set(agentId, engine);
  }

  // 获取预热的 Engine
  getWarmEngine(agentId: string): DestroyableEngine | undefined {
    return this.warmEngines.get(agentId);
  }
}
```

**时机**：
- Agent 被激活时预热
- 用户打开 AgentChat 页面时预热
- 定期预热活跃 Agent

#### 优化 2：Session 复用策略

**思路**：同一个 Thread 的 Engine 在完成后不立即销毁，而是保留在池中一段时间（LRU）。

**当前状态**：`thread-manager.ts` 的 EnginePool 已经实现了 LRU，但淘汰策略可能需要优化。

**优化点**：
- 增加"热" Thread 的保留时间
- 实现分层缓存：热 Thread → 温 Thread → 冷 Thread

### 2.3 前端优化（Phase 3 - 真实时渲染）

#### 优化 1：移除假打字动画

**修改**：`web/src/components/chat/TextBlock.tsx`

```typescript
export function TextBlock({ content, isStreaming, isDelta }: TextBlockProps) {
  // 当 isDelta=true 时，直接追加内容，不做打字动画
  const [displayedContent, setDisplayedContent] = useState('');

  useEffect(() => {
    if (isDelta) {
      // 增量模式：直接追加
      setDisplayedContent(prev => prev + content);
    } else {
      // 兼容模式：显示全部内容
      setDisplayedContent(content);
    }
  }, [content, isDelta]);

  return (
    <div className="...">
      <ReactMarkdown>{displayedContent}</ReactMarkdown>
      {isStreaming && <span className="cursor">▋</span>}
    </div>
  );
}
```

#### 优化 2：添加思考指示器

在首 Token 到达前，显示"Agent 思考中..."动画：

```typescript
// web/src/hooks/useChatMessages.ts

const [isThinking, setIsThinking] = useState(false);

const sendMessage = useCallback((agentId, threadId, content) => {
  setIsThinking(true);  // 立即显示思考状态

  sendThreadMessage(agentId, threadId, content, {
    onEvent: (event) => {
      if (event.type === 'text') {
        setIsThinking(false);  // 首个文本到达，关闭思考状态
        // ...
      }
    },
    // ...
  });
}, []);
```

#### 优化 3：渐进式 Markdown 渲染

使用支持增量渲染的 Markdown 库，避免每秒重新渲染整个文档：

```typescript
// 使用 react-markdown 的流式支持
import { DirectedGraph } from 'markdown-to-ast';

// 或者使用轻量级的增量渲染器
```

---

## 三、实施计划

### Phase 1：验证 SDK 流式行为（1 天）

1. **测试 SDK 的 `assistant` 事件格式**
   - 编写测试脚本，打印每个 `assistant` 事件的 `message.content`
   - 验证是否包含增量标记（如 `delta: true`）
   - 测试不同模型（claude-sonnet-4、glm-5.1）的行为

2. **决策点**：
   - 如果 SDK 支持增量 → 执行方案 A
   - 如果 SDK 不支持 → 评估是否值得做方案 B

### Phase 2：后端增量流式实现（2-3 天）

1. **修改 `sse-event-mapper.ts`**，支持增量文本事件
2. **修改前端 `useChatMessages.ts`**，支持增量追加
3. **修改 `TextBlock.tsx`**，移除假打字动画
4. **E2E 测试**：验证流式效果

### Phase 3：TTFT 优化（3-5 天）

1. **实现 Engine 预热池**
2. **优化 LRU 策略**
3. **添加思考指示器**
4. **性能测试**：测量 TTFT 改善

---

## 四、数据结构

### 4.1 增强的 SSE 事件

```typescript
export interface SSETextEvent {
  type: 'text';
  content: string;
  isDelta?: boolean;   // 是否为增量
  isFinal?: boolean;   // 是否为最终完成
  index?: number;      // 增量索引（用于排序）
}
```

### 4.2 前端消息状态

```typescript
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  blocks: MessageBlock[];
  status: 'thinking' | 'streaming' | 'complete';  // 新增 'thinking'
  ttft?: number;  // 记录首 Token 时间（用于监控）
}
```

---

## 五、验收标准

### 5.1 功能验收

1. **真正的流式输出**：文本逐字/逐句出现，而不是等待后一把出现
2. **首 Token 时间**：TTFT < 2 秒（当前约 3-5 秒）
3. **思考指示器**：用户发送消息后 100ms 内显示"思考中"状态
4. **兼容性**：长文本、多工具调用场景下流式仍然正常

### 5.2 性能验收

1. **P50 TTFT**：< 1.5 秒
2. **P95 TTFT**：< 3 秒
3. **首字延迟**：< 500ms（从首个 SSE 事件到首字显示）

### 5.3 用户体验验收

1. **焦虑感降低**：用户在发送后 1 秒内看到某种反馈（思考指示器或首字）
2. **流式感知**：文本呈现明显的时间梯度，不是"突然全部出现"

---

## 六、风险与备选方案

### 风险 1：SDK 不支持真正的增量

**应对**：
- 使用方案 B（后端切分），虽然无法改善 TTFT，但可以改善流式感知
- 或者接受现状，专注于其他优化（思考指示器、Engine 预热）

### 风险 2：增量渲染导致 Markdown 错误

**应对**：
- 使用流式友好的 Markdown 解析器
- 或者采用"两阶段渲染"：流式显示纯文本，完成后切换为 Markdown

### 风险 3：Engine 预热增加资源消耗

**应对**：
- 限制预热池大小（如最多 10 个 Engine）
- 实现 LRU 淘汰策略
- 监控资源使用，动态调整预热策略

---

## 七、后续优化方向

1. **HTTP/2 推送**：考虑使用 HTTP/2 的服务器推送能力
2. **WebSocket 备选**：SSE 断线时自动切换到 WebSocket
3. **客户端预测**：基于 Agent 历史行为，预测并预渲染常见回复
4. **模型选择优化**：简单查询使用快速模型（如 Haiku），复杂任务使用主力模型
