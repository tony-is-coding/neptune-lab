# 用户澄清 UI（Checkpoint）方案

## 一、现状分析

### 1.1 PermissionDelegate 当前机制

**位置**：`server/src/services/permission-delegate.ts`

```typescript
async onToolAccess(
  toolName: string,
  input: Record<string, unknown>,
): Promise<'allow' | 'deny'> {
  // ... 各种检查

  return 'allow';  // 永远不返回 'ask'
  // 注意：永远不返回 'ask'——服务端无头模式
}
```

**关键发现**：
1. 当前 PermissionDelegate 只返回 `allow` 或 `deny`，**从不返回 `ask`**
2. `bypassPermissions: true`（`engine-factory.ts:85`）意味着跳过所有权限确认
3. SDK 的 `ask` 机制被完全禁用

### 1.2 为什么需要 Checkpoint

**用户场景**：

1. **文件删除确认**：Agent 要删除文件，需要用户确认
2. **API 调用确认**：Agent 要调用付费 API，需要用户确认
3. **多选决策**：Agent 需要从多个选项中选择，询问用户偏好
4. **模糊指令澄清**：用户指令不明确，Agent 需要澄清

**当前问题**：
- Agent 无法暂停执行并等待用户输入
- 用户只能通过"发送新消息"来响应，但这会创建新的对话轮次
- 上下文不连贯，用户体验差

---

## 二、解决方案

### 2.1 核心设计思路

**方案：半阻塞式 Checkpoint**

```
Agent 执行中遇到需要用户确认的点
  ↓
创建 Checkpoint（包含选项/问题）
  ↓
Agent 进入"等待用户响应"状态（但 SSE 连接保持）
  ↓
前端显示选择弹窗（从对话底部弹出）
  ↓
用户选择/输入
  ↓
前端通过新 API 提交用户响应
  ↓
后端将用户响应作为"伪 tool_result" 返回给 Agent
  ↓
Agent 继续执行
```

**关键设计决策**：
1. **不使用 SDK 的 `ask` 机制**：因为当前 bypassPermissions=true，且改为 ask 模式会影响现有架构
2. **使用专用工具**：创建 `AskUser` 工具，Agent 主动调用
3. **半阻塞**：SSE 连接保持，但 Agent 执行暂停

---

## 三、详细设计

### 3.1 后端改动

#### 3.1.1 新增 AskUser 工具

**新建**：`server/src/tools/AskUserTool.ts`

```typescript
import type { Tool } from 'claude-code-best/engine';

export interface AskUserInput {
  question: string;           // 向用户提出的问题
  options?: string[];         // 可选的预设选项
  type?: 'choice' | 'text' | 'confirm';  // 交互类型
  timeout?: number;           // 超时时间（秒），默认 300（5 分钟）
}

export interface AskUserOutput {
  response: string;           // 用户的响应
  selectedOption?: string;    // 如果是 choice，返回选中的选项
}

export const AskUserTool: Tool<AskUserInput, AskUserOutput> = {
  name: 'AskUser',
  description: '向用户提问并等待响应。用于需要用户确认或选择的情况。',
  inputSchema: {
    type: 'object',
    properties: {
      question: {
        type: 'string',
        description: '向用户提出的问题',
      },
      options: {
        type: 'array',
        items: { type: 'string' },
        description: '预设选项（可选）',
      },
      type: {
        type: 'string',
        enum: ['choice', 'text', 'confirm'],
        description: '交互类型：choice（单选）、text（文本输入）、confirm（确认）',
      },
      timeout: {
        type: 'number',
        description: '超时时间（秒）',
      },
    },
    required: ['question'],
  },

  async execute(input: AskUserInput, context: { sessionId: string }): Promise<AskUserOutput> {
    // 1. 创建 Checkpoint
    const checkpointId = await createCheckpoint({
      sessionId: context.sessionId,
      question: input.question,
      options: input.options || [],
      type: input.type || (input.options ? 'choice' : 'text'),
      timeout: input.timeout || 300,
    });

    // 2. 等待用户响应（阻塞）
    const response = await waitForResponse(checkpointId);

    // 3. 返回结果
    return {
      response: response.value,
      selectedOption: response.selectedOption,
    };
  },
};
```

#### 3.1.2 Checkpoint 存储和管理

**新建**：`server/src/services/checkpoint-manager.ts`

```typescript
import { randomUUID } from 'crypto';

export interface Checkpoint {
  id: string;
  sessionId: string;
  threadId: string;
  question: string;
  options: string[];
  type: 'choice' | 'text' | 'confirm';
  status: 'pending' | 'answered' | 'expired' | 'cancelled';
  createdAt: Date;
  expiresAt: Date;
  response?: {
    value: string;
    selectedOption?: string;
    answeredAt: Date;
  };
}

class CheckpointManager {
  private checkpoints: Map<string, Checkpoint> = new Map();
  private pendingResponses: Map<string, {
    resolve: (response: Checkpoint['response']) => void;
    reject: (error: Error) => void;
  }> = new Map();

  // 创建 Checkpoint
  async create(params: {
    sessionId: string;
    threadId: string;
    question: string;
    options: string[];
    type: 'choice' | 'text' | 'confirm';
    timeout: number;
  }): Promise<string> {
    const id = randomUUID();
    const now = new Date();
    const checkpoint: Checkpoint = {
      id,
      sessionId: params.sessionId,
      threadId: params.threadId,
      question: params.question,
      options: params.options,
      type: params.type,
      status: 'pending',
      createdAt: now,
      expiresAt: new Date(now.getTime() + params.timeout * 1000),
    };

    this.checkpoints.set(id, checkpoint);

    // 设置超时
    setTimeout(() => {
      this.expire(id);
    }, params.timeout * 1000);

    return id;
  }

  // 等待用户响应（由 AskUser 工具调用）
  async waitFor(checkpointId: string): Promise<Checkpoint['response']> {
    return new Promise((resolve, reject) => {
      this.pendingResponses.set(checkpointId, { resolve, reject });
    });
  }

  // 用户提交响应（由 API 调用）
  async respond(checkpointId: string, response: {
    value: string;
    selectedOption?: string;
  }): Promise<void> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      throw new Error('Checkpoint not found');
    }
    if (checkpoint.status !== 'pending') {
      throw new Error('Checkpoint not pending');
    }

    checkpoint.response = {
      ...response,
      answeredAt: new Date(),
    };
    checkpoint.status = 'answered';

    // 通知等待的 AskUser 工具
    const pending = this.pendingResponses.get(checkpointId);
    if (pending) {
      pending.resolve(checkpoint.response);
      this.pendingResponses.delete(checkpointId);
    }
  }

  // 超时处理
  private expire(checkpointId: string): void {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint || checkpoint.status !== 'pending') return;

    checkpoint.status = 'expired';

    const pending = this.pendingResponses.get(checkpointId);
    if (pending) {
      pending.reject(new Error('Checkpoint expired'));
      this.pendingResponses.delete(checkpointId);
    }
  }

  // 获取 Checkpoint
  get(checkpointId: string): Checkpoint | undefined {
    return this.checkpoints.get(checkpointId);
  }

  // 取消 Checkpoint
  cancel(checkpointId: string): void {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint || checkpoint.status !== 'pending') return;

    checkpoint.status = 'cancelled';

    const pending = this.pendingResponses.get(checkpointId);
    if (pending) {
      pending.reject(new Error('Checkpoint cancelled'));
      this.pendingResponses.delete(checkpointId);
    }
  }
}

export const checkpointManager = new CheckpointManager();
```

#### 3.1.3 SSE 事件支持

**修改**：`server/src/services/sse-event-mapper.ts`

```typescript
// 新增 Checkpoint 事件
export interface SSECheckpointEvent {
  type: 'checkpoint';
  checkpointId: string;
  question: string;
  options: string[];
  interactionType: 'choice' | 'text' | 'confirm';
  timeout: number;
}

// 映射函数（通过监听 AskUser 工具调用）
case 'tool_use': {
  const toolName = sdkEvent.name as string;
  if (toolName === 'AskUser') {
    const input = sdkEvent.input as AskUserInput;
    return [{
      type: 'checkpoint',
      checkpointId: sdkEvent.checkpointId,  // 从工具上下文获取
      question: input.question,
      options: input.options || [],
      interactionType: input.type || 'text',
      timeout: input.timeout || 300,
    }];
  }
  // ... 其他 tool_use 处理
}
```

#### 3.1.4 新增 API 端点

**新建**：`server/src/routes/checkpoints.ts`

```typescript
import type { FastifyInstance } from 'fastify';
import { checkpointManager } from '../services/checkpoint-manager';

export async function checkpointRoutes(fastify: FastifyInstance) {
  // 提交 Checkpoint 响应
  fastify.post('/checkpoints/:checkpointId/respond', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { checkpointId } = request.params as { checkpointId: string };
    const { value, selectedOption } = request.body as {
      value: string;
      selectedOption?: string;
    };

    try {
      await checkpointManager.respond(checkpointId, { value, selectedOption });
      reply.send({ success: true });
    } catch (error) {
      reply.status(400).send({
        error: 'INVALID_REQUEST',
        message: error instanceof Error ? error.message : 'Failed to respond',
      });
    }
  });

  // 取消 Checkpoint
  fastify.post('/checkpoints/:checkpointId/cancel', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { checkpointId } = request.params as { checkpointId: string };

    checkpointManager.cancel(checkpointId);
    reply.send({ success: true });
  });

  // 获取 Checkpoint 状态
  fastify.get('/checkpoints/:checkpointId', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { checkpointId } = request.params as { checkpointId: string };

    const checkpoint = checkpointManager.get(checkpointId);
    if (!checkpoint) {
      return reply.status(404).send({
        error: 'NOT_FOUND',
        message: 'Checkpoint not found',
      });
    }

    reply.send(checkpoint);
  });
}
```

### 3.2 前端改动

#### 3.2.1 类型定义

**修改**：`web/src/types/chat.ts`

```typescript
// 新增 Checkpoint 类型
export interface Checkpoint {
  id: string;
  sessionId: string;
  threadId: string;
  question: string;
  options: string[];
  interactionType: 'choice' | 'text' | 'confirm';
  status: 'pending' | 'answered' | 'expired' | 'cancelled';
  timeout: number;
  createdAt: string;
  expiresAt: string;
}

// 扩展 MessageBlock
export type MessageBlock =
  | // ... 现有类型
  | { type: 'checkpoint'; checkpoint: Checkpoint };
```

#### 3.2.2 Checkpoint 弹窗组件

**新建**：`web/src/components/chat/CheckpointModal.tsx`

```typescript
import { useState, useEffect } from 'react';
import type { Checkpoint } from '../../types/chat';

interface CheckpointModalProps {
  checkpoint: Checkpoint;
  onRespond: (response: { value: string; selectedOption?: string }) => void;
  onCancel: () => void;
  autoExpire?: boolean;  // 超时自动关闭
}

export function CheckpointModal({
  checkpoint,
  onRespond,
  onCancel,
  autoExpire = true,
}: CheckpointModalProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [textValue, setTextValue] = useState('');
  const [timeLeft, setTimeLeft] = useState(checkpoint.timeout);

  // 倒计时
  useEffect(() => {
    if (!autoExpire) return;

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          onCancel();  // 超时自动取消
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [autoExpire, onCancel]);

  const handleSubmit = () => {
    if (checkpoint.interactionType === 'choice') {
      if (!selectedOption) return;
      onRespond({ value: selectedOption, selectedOption });
    } else if (checkpoint.interactionType === 'confirm') {
      onRespond({ value: 'yes', selectedOption: 'yes' });
    } else {
      if (!textValue.trim()) return;
      onRespond({ value: textValue });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
      <div className="bg-surface rounded-t-2xl w-full max-w-lg p-6 shadow-lg">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-charcoal">需要您的确认</h3>
          {timeLeft > 0 && (
            <span className="text-sm text-text-muted">{timeLeft}秒后自动取消</span>
          )}
        </div>

        {/* 问题 */}
        <p className="text-charcoal mb-6">{checkpoint.question}</p>

        {/* 选项/输入 */}
        {checkpoint.interactionType === 'choice' && checkpoint.options.length > 0 && (
          <div className="space-y-2 mb-6">
            {checkpoint.options.map((option, index) => (
              <button
                key={index}
                onClick={() => setSelectedOption(option)}
                className={`w-full text-left p-3 rounded-lg border transition ${
                  selectedOption === option
                    ? 'border-np-primary bg-np-primary/10 text-np-primary'
                    : 'border-border-cream bg-surface-container-low text-charcoal hover:bg-surface-container'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        )}

        {checkpoint.interactionType === 'text' && (
          <textarea
            value={textValue}
            onChange={e => setTextValue(e.target.value)}
            placeholder="请输入您的回答..."
            className="w-full p-3 border border-border-cream rounded-lg bg-surface-container-low text-charcoal resize-none"
            rows={3}
          />
        )}

        {checkpoint.interactionType === 'confirm' && (
          <div className="bg-surface-container-highest p-4 rounded-lg mb-6">
            <p className="text-sm text-text-muted">
              点击"确认"继续，点击"取消"中止操作
            </p>
          </div>
        )}

        {/* 按钮 */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 px-4 rounded-lg border border-border-cream text-charcoal hover:bg-surface-container transition"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={
              (checkpoint.interactionType === 'choice' && !selectedOption) ||
              (checkpoint.interactionType === 'text' && !textValue.trim())
            }
            className="flex-1 py-2.5 px-4 rounded-lg bg-np-primary text-white hover:bg-np-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            确认
          </button>
        </div>
      </div>
    </div>
  );
}
```

#### 3.2.3 API 客户端

**修改**：`web/src/api/checkpoints.ts`

```typescript
import { API_BASE, getAuthHeaders } from './client';

export async function respondToCheckpoint(
  checkpointId: string,
  response: { value: string; selectedOption?: string },
): Promise<void> {
  const res = await fetch(`${API_BASE}/checkpoints/${checkpointId}/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(response),
  });

  if (!res.ok) {
    throw new Error(`Failed to respond: ${res.status}`);
  }
}

export async function cancelCheckpoint(checkpointId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/checkpoints/${checkpointId}/cancel`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    throw new Error(`Failed to cancel: ${res.status}`);
  }
}
```

#### 3.2.4 useChatMessages Hook 更新

**修改**：`web/src/hooks/useChatMessages.ts`

```typescript
import { respondToCheckpoint, cancelCheckpoint } from '../api/checkpoints';

// 新增状态
const [activeCheckpoint, setActiveCheckpoint] = useState<Checkpoint | null>(null);

// 在 onEvent 中处理 Checkpoint
onEvent: (event) => {
  // ... 现有处理

  if (event.type === 'checkpoint') {
    const checkpoint = event.data as Checkpoint;
    setActiveCheckpoint(checkpoint);
  }
},

// 处理用户响应
const handleCheckpointResponse = useCallback(async (response: {
  value: string;
  selectedOption?: string;
}) => {
  if (!activeCheckpoint) return;

  try {
    await respondToCheckpoint(activeCheckpoint.id, response);
    setActiveCheckpoint(null);
  } catch (error) {
    console.error('Failed to respond to checkpoint:', error);
  }
}, [activeCheckpoint]);

// 处理取消
const handleCheckpointCancel = useCallback(async () => {
  if (!activeCheckpoint) return;

  try {
    await cancelCheckpoint(activeCheckpoint.id);
    setActiveCheckpoint(null);
  } catch (error) {
    console.error('Failed to cancel checkpoint:', error);
  }
}, [activeCheckpoint]);

return {
  // ... 现有返回
  activeCheckpoint,
  handleCheckpointResponse,
  handleCheckpointCancel,
};
```

---

## 四、交互流程

### 4.1 典型流程

```
Agent：执行中...
  ↓
Agent：遇到需要确认的操作（如删除文件）
  ↓
Agent：调用 AskUser 工具
  {
    question: "确定要删除 sales_data.csv 吗？",
    type: "confirm"
  }
  ↓
后端：创建 Checkpoint，阻塞等待
  ↓
SSE：发送 checkpoint 事件
  ↓
前端：从底部弹出确认弹窗
  ↓
用户：点击"确认"
  ↓
前端：调用 POST /checkpoints/:id/respond
  ↓
后端：CheckpointManager 解除阻塞
  ↓
Agent：收到响应，继续执行
  ↓
前端：弹窗关闭，显示 Agent 继续工作
```

### 4.2 状态图

```
Checkpoint 状态：
  pending → answered
    ↓
  expired (超时)
    ↓
  cancelled (用户取消)
```

---

## 五、实施计划

### Phase 1：后端基础（3-4 天）

1. **实现 CheckpointManager**
2. **创建 AskUser 工具**
3. **添加 SSE Checkpoint 事件**
4. **实现 Checkpoint API 路由**
5. **编写单元测试**

### Phase 2：前端 UI（2-3 天）

1. **创建 CheckpointModal 组件**
2. **实现 Checkpoint API 客户端**
3. **修改 useChatMessages Hook**
4. **添加动画和过渡效果**

### Phase 3：集成测试（1-2 天）

1. **端到端测试**：完整流程测试
2. **边界场景**：超时、取消、网络断开
3. **性能测试**：多 Checkpoint 并发

### Phase 4：优化（可选，2-3 天）

1. **历史记录**：保存 Checkpoint 历史
2. **快捷响应**：记住用户的常用选择
3. **批量确认**：多个 Checkpoint 合并确认

---

## 六、数据结构

### 6.1 Checkpoint 对象

```typescript
interface Checkpoint {
  id: string;                    // UUID
  sessionId: string;             // SDK Session ID
  threadId: string;              // Thread ID
  question: string;              // 问题文本
  options: string[];             // 预设选项（可选）
  interactionType: 'choice' | 'text' | 'confirm';
  status: 'pending' | 'answered' | 'expired' | 'cancelled';
  timeout: number;               // 超时时间（秒）
  createdAt: Date;
  expiresAt: Date;
  response?: {
    value: string;
    selectedOption?: string;
    answeredAt: Date;
  };
}
```

### 6.2 SSE 事件

```typescript
// Checkpoint 创建事件
{
  type: 'checkpoint';
  data: {
    checkpointId: string;
    question: string;
    options: string[];
    interactionType: 'choice' | 'text' | 'confirm';
    timeout: number;
  };
}

// Checkpoint 状态更新（可选，用于前端同步）
{
  type: 'checkpoint_status';
  data: {
    checkpointId: string;
    status: 'answered' | 'expired' | 'cancelled';
  };
}
```

---

## 七、验收标准

### 7.1 功能验收

1. **弹窗正确显示**：Checkpoints 以底部弹窗形式展示
2. **响应正确提交**：用户选择能正确传递给 Agent
3. **超时处理**：超时后自动取消并通知用户
4. **取消功能**：用户可以主动取消

### 7.2 用户体验验收

1. **非阻塞式**：弹窗不影响其他 UI 交互
2. **清晰可见**：用户不会错过 Checkpoint
3. **操作简单**：一键确认/取消
4. **动画流畅**：弹入/弹出动画自然

### 7.3 边界场景

1. **多个 Checkpoint**：同时有多个 Checkpoint 时的处理（队列）
2. **网络断开**：重连后 Checkpoint 状态恢复
3. **页面刷新**：刷新后能恢复活跃的 Checkpoint
4. **Agent 异常**：Agent 异常退出时 Checkpoint 清理

---

## 八、风险与备选方案

### 风险 1：阻塞导致资源泄漏

**场景**：用户长时间不响应，Checkpoint 占用内存。

**应对**：
- 设置合理的超时（默认 5 分钟）
- 定期清理过期 Checkpoint
- 监控 Checkpoint 数量，设置上限

### 风险 2：AskUser 工具与 bypassPermissions 冲突

**分析**：`bypassPermissions: true` 跳过权限检查，但 AskUser 不是权限工具，是业务工具。

**应对**：
- 确保 AskUser 工具不在禁用列表中
- 工具白名单包含 `AskUser`

### 风险 3：并发 Checkpoint 处理

**场景**：Agent 可能同时创建多个 Checkpoint（如并行子 Agent）。

**应对**：
- 实现 Checkpoint 队列，按顺序展示
- 或允许同时展示，但限制数量（最多 3 个）

### 风险 4：用户跳过 Checkpoint

**场景**：用户可能直接发新消息，忽略 Checkpoint。

**应对**：
- 新消息自动取消活跃 Checkpoint
- 或将新消息作为 Checkpoint 的响应

---

## 九、后续优化方向

1. **智能 Checkpoint**：根据历史行为预测用户响应
2. **Checkpoint 模板**：预定义常用确认问题
3. **快捷响应**：记住用户的选择，下次自动应用
4. **多轮确认**：支持多轮澄清（如动态生成选项）
5. **协作 Checkpoint**：多人协作时，指定需要谁确认
