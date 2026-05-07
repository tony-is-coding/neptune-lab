# Plan 模式后端协议设计

> **设计者**: architect-2
> **日期**: 2026-05-07
> **状态**: 设计阶段

---

## 1. 概述

### 1.1 设计目标

Plan 模式让 Agent 处理复杂任务时，先列出步骤，然后逐步执行并在对话框中展示进度。Phase 1 自动执行，不需要用户确认。

### 1.2 设计原则

1. **最小侵入**：不破坏现有 SSE 事件流和 ThreadManager 架构
2. **渐进增强**：Plan 作为可选功能，不强制所有 Agent 使用
3. **事件驱动**：利用现有 SSE 机制传输 Plan 状态
4. **内存优先**：Plan 状态暂存内存，按需持久化

---

## 2. Plan SSE 事件协议

### 2.1 新增 SSE 事件类型

```typescript
/**
 * Plan 创建事件
 * 当 Agent 首次调用 TaskCreate 工具时触发
 */
interface SSEPlanCreatedEvent {
  type: 'plan_created';
  planId: string;
  title: string;         // Plan 标题（从首个 Task 的 subject 提取）
  totalSteps: number;    // 总步骤数
  createdAt: string;     // ISO 8601 时间戳
}

/**
 * Plan 步骤更新事件
 * 当步骤状态变化时触发
 */
interface SSEPlanStepEvent {
  type: 'plan_step';
  planId: string;
  stepId: string;
  stepNumber: number;    // 步骤序号（从 1 开始）
  subject: string;       // 步骤标题
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  activeForm?: string;   // 进行中的文本描述（如 "正在运行测试"）
  updatedAt: string;     // ISO 8601 时间戳
}

/**
 * Plan 完成事件
 * 当所有步骤完成或 Plan 失败时触发
 */
interface SSEPlanDoneEvent {
  type: 'plan_done';
  planId: string;
  status: 'completed' | 'failed';
  summary?: string;      // 完成摘要
  duration: number;      // 执行时长（毫秒）
  completedAt: string;   // ISO 8601 时间戳
}
```

### 2.2 事件类型联合

```typescript
type SSEPlanEvent =
  | SSEPlanCreatedEvent
  | SSEPlanStepEvent
  | SSEPlanDoneEvent;

// 扩展现有 SSEEvent 联合类型
type SSEEvent =
  | SSETextEvent
  | SSEToolUseEvent
  | SSEToolResultEvent
  | SSEToolStatusEvent
  | SSEErrorEvent
  | SSEDoneEvent
  | SSEPlanEvent;  // 新增
```

### 2.3 事件流示例

```
[用户发送消息] → "帮我部署这个项目"

[SSE 事件流]
1. plan_created → { planId: "plan-123", title: "部署项目", totalSteps: 3 }
2. plan_step → { stepNumber: 1, status: "in_progress", subject: "构建 Docker 镜像" }
3. plan_step → { stepNumber: 1, status: "completed", subject: "构建 Docker 镜像" }
4. plan_step → { stepNumber: 2, status: "in_progress", subject: "推送镜像到 registry" }
5. plan_step → { stepNumber: 2, status: "completed", subject: "推送镜像到 registry" }
6. plan_step → { stepNumber: 3, status: "in_progress", subject: "更新 K8s 部署" }
7. plan_step → { stepNumber: 3, status: "completed", subject: "更新 K8s 部署" }
8. plan_done → { status: "completed", duration: 45000 }
9. text → "项目部署完成！"
10. done → {}
```

---

## 3. Plan 数据结构

### 3.1 内存数据结构

```typescript
/**
 * Plan 步骤
 */
interface PlanStep {
  id: string;              // 步骤 ID（UUID）
  stepNumber: number;      // 步骤序号
  subject: string;         // 步骤标题
  description: string;     // 步骤描述
  activeForm?: string;     // 进行中描述
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  metadata?: Record<string, unknown>;  // 自定义元数据
}

/**
 * Plan（内存结构）
 */
interface Plan {
  id: string;              // Plan ID（UUID）
  sessionId: string;       // 所属 Session ID
  title: string;           // Plan 标题
  description?: string;    // Plan 描述
  steps: PlanStep[];       // 步骤列表
  status: 'active' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  metadata?: Record<string, unknown>;
}
```

### 3.2 数据库扩展（可选，Phase 2）

```sql
-- Plan 表（Phase 2 可选）
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'completed' | 'failed'
  steps JSONB NOT NULL DEFAULT '[]',    -- PlanStep[]
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX plans_session_id_idx ON plans(session_id);
CREATE INDEX plans_tenant_id_idx ON plans(tenant_id);
```

### 3.3 类型定义位置

- 内存结构：`server/src/services/plan/types.ts`
- 数据库 Schema：`server/src/db/schema.ts`（Phase 2）

---

## 4. 与现有架构的集成

### 4.1 ThreadManager.dispatch() 集成

```typescript
// ThreadManager.dispatch() 增加上下文
interface QueryContext {
  sessionId: string;
  planManager: PlanManager;  // 新增：Plan 管理器
}

// dispatch() 方法内部
async *dispatch(threadId: string, content: string): AsyncGenerator<unknown> {
  // ... 现有逻辑 ...

  // 创建 PlanManager（每次 dispatch 新建）
  const planManager = new PlanManager(threadId);

  // 监听 SDK 的 TaskCreate/TaskUpdate 事件
  engine.on('task:created', handleTaskCreated);
  engine.on('task:updated', handleTaskUpdated);

  // 执行 query
  for await (const event of queryable.query(sdkSessionId, content)) {
    // 通过 PlanManager 转换事件
    const planEvents = planManager.processSDKEvent(event);
    for (const planEvent of planEvents) {
      yield planEvent;
    }

    // 原有事件继续 yield
    yield event;
  }
}
```

### 4.2 PlanManager 设计

```typescript
/**
 * PlanManager — Plan 状态管理和事件转换
 *
 * 职责：
 * 1. 监听 SDK 的 TaskCreate/TaskUpdate 事件
 * 2. 维护 Plan 状态（内存）
 * 3. 将 SDK 事件转换为 SSE Plan 事件
 * 4. 计算进度并触发状态变更
 */
class PlanManager {
  private plans: Map<string, Plan> = new Map();
  private currentPlanId: string | null = null;

  constructor(private sessionId: string) {}

  /**
   * 处理 SDK 事件，返回 SSE Plan 事件数组
   */
  processSDKEvent(sdkEvent: Record<string, unknown>): SSEPlanEvent[] {
    // 1. 识别 TaskCreate 事件
    if (this.isTaskCreateEvent(sdkEvent)) {
      return this.handleTaskCreate(sdkEvent);
    }

    // 2. 识别 TaskUpdate 事件
    if (this.isTaskUpdateEvent(sdkEvent)) {
      return this.handleTaskUpdate(sdkEvent);
    }

    return [];
  }

  private isTaskCreateEvent(event: Record<string, unknown>): boolean {
    // SDK TaskCreate 工具调用产生的事件特征
    return event.type === 'tool_use' &&
           event.name === 'TaskCreate' &&
           event.input?.subject;
  }

  private isTaskUpdateEvent(event: Record<string, unknown>): boolean {
    // SDK TaskUpdate 工具调用产生的事件特征
    return event.type === 'tool_use' &&
           event.name === 'TaskUpdate' &&
           event.input?.taskId &&
           event.input?.status;
  }

  private handleTaskCreate(event: Record<string, unknown>): SSEPlanEvent[] {
    const events: SSEPlanEvent[] = [];
    const input = event.input as { subject: string; description: string };

    if (!this.currentPlanId) {
      // 首个 Task → 创建 Plan
      const plan = this.createPlan(input.subject);
      this.currentPlanId = plan.id;
      events.push(this.toPlanCreatedEvent(plan));
    }

    // 添加步骤
    const step = this.addStep(input);
    events.push(this.toPlanStepEvent(step));

    return events;
  }

  private handleTaskUpdate(event: Record<string, unknown>): SSEPlanEvent[] {
    const input = event.input as {
      taskId: string;
      status: 'pending' | 'in_progress' | 'completed' | 'failed';
    };

    const step = this.updateStep(input.taskId, input.status);
    if (!step) return [];

    const events: SSEPlanEvent[] = [this.toPlanStepEvent(step)];

    // 检查 Plan 是否完成
    if (this.isPlanCompleted()) {
      events.push(this.toPlanDoneEvent());
    }

    return events;
  }

  // ... 其他辅助方法
}
```

### 4.3 SSE 事件映射扩展

```typescript
// server/src/services/sse-event-mapper.ts

export function mapSSEEvent(sdkEvent: Record<string, unknown>): SSEEvent[] {
  const eventType = sdkEvent.type as string;

  // 新增：Plan 事件映射
  if (isPlanRelatedEvent(sdkEvent)) {
    return mapPlanEvent(sdkEvent);
  }

  // 现有逻辑...
  switch (eventType) {
    case 'assistant': { /* ... */ }
    case 'tool_use': { /* ... */ }
    // ...
  }
}

/**
 * 判断是否为 Plan 相关事件
 */
function isPlanRelatedEvent(event: Record<string, unknown>): boolean {
  if (event.type === 'tool_use') {
    const name = event.name as string;
    return name === 'TaskCreate' || name === 'TaskUpdate';
  }
  return false;
}

/**
 * 映射 Plan 事件
 */
function mapPlanEvent(sdkEvent: Record<string, unknown>): SSEEvent[] {
  const name = sdkEvent.name as string;

  if (name === 'TaskCreate') {
    // 返回 plan_created + plan_step 事件
    return [
      {
        type: 'plan_created',
        planId: generatePlanId(),
        title: extractPlanTitle(sdkEvent),
        totalSteps: estimateTotalSteps(sdkEvent),
        createdAt: new Date().toISOString(),
      },
      {
        type: 'plan_step',
        stepId: extractStepId(sdkEvent),
        stepNumber: 1,
        subject: extractSubject(sdkEvent),
        status: 'pending',
        updatedAt: new Date().toISOString(),
      }
    ];
  }

  if (name === 'TaskUpdate') {
    return [{
      type: 'plan_step',
      stepId: extractStepId(sdkEvent),
      stepNumber: extractStepNumber(sdkEvent),
      subject: extractSubject(sdkEvent),
      status: extractStatus(sdkEvent),
      activeForm: extractActiveForm(sdkEvent),
      updatedAt: new Date().toISOString(),
    }];
  }

  return [];
}
```

---

## 5. Agent SDK TaskCreate 工具利用

### 5.1 现有 TaskCreate 工具

SDK 已内置 `TaskCreate` 工具（位于 `claude-code-best/builtin-tools/tools/TaskCreateTool/`）：

```typescript
// 输入 Schema
{
  subject: string;      // 任务标题
  description: string;  // 任务描述
  activeForm?: string;  // 进行中描述
  metadata?: Record<string, unknown>;
}

// 输出 Schema
{
  task: {
    id: string;
    subject: string;
  };
}
```

### 5.2 利用策略

1. **工具白名单**：在 Agent 模板的 `tools` 配置中添加 `TaskCreate` 和 `TaskUpdate`
2. **System Prompt 引导**：在 Agent 的 systemPrompt 中引导使用 TaskCreate
3. **事件监听**：通过 SSE 事件映射层监听工具调用

### 5.3 System Prompt 示例

```
你是一个专业的 AI 助手。当处理复杂任务时，请遵循以下流程：

1. **Plan 模式**：对于需要多步骤的任务，先使用 TaskCreate 工具创建任务列表
2. **逐步执行**：依次执行每个任务，使用 TaskUpdate 更新状态
3. **状态更新**：任务开始时设置为 in_progress，完成后设置为 completed

示例：
- TaskCreate: { subject: "分析代码", description: "分析 src/ 目录的代码结构" }
- TaskUpdate: { taskId: "xxx", status: "in_progress" }
- TaskUpdate: { taskId: "xxx", status: "completed" }
```

---

## 6. 实现路径

### 6.1 改动文件清单

| 文件 | 改动类型 | 改动范围 |
|------|---------|---------|
| `server/src/services/plan/types.ts` | 新增 | Plan 数据结构定义 |
| `server/src/services/plan/PlanManager.ts` | 新增 | Plan 管理器核心逻辑 |
| `server/src/services/sse-event-mapper.ts` | 修改 | 增加 Plan 事件映射 |
| `server/src/services/thread-manager.ts` | 修改 | 集成 PlanManager |
| `server/src/routes/threads.ts` | 修改 | SSE 路由支持 Plan 事件 |
| `server/src/db/schema.ts` | 修改（Phase 2） | 增加 plans 表 |

### 6.2 实现阶段

#### Phase 1：MVP（内存存储）

1. **数据结构**：定义 Plan 和 PlanStep 类型
2. **PlanManager**：实现核心逻辑（创建、更新、状态转换）
3. **SSE 映射**：扩展 `mapSSEEvent` 支持 Plan 事件
4. **ThreadManager 集成**：在 dispatch() 中注入 PlanManager
5. **测试**：验证 Plan 事件流正确传输

#### Phase 2：持久化存储（可选）

1. **数据库 Schema**：增加 plans 表
2. **持久化逻辑**：Plan 状态写入数据库
3. **查询 API**：提供 Plan 历史查询接口

### 6.3 详细步骤

**Step 1：数据结构定义**
```bash
# 创建文件
touch server/src/services/plan/types.ts
```

**Step 2：PlanManager 实现**
```bash
# 创建文件
touch server/src/services/plan/PlanManager.ts
```

**Step 3：SSE 事件映射扩展**
```bash
# 修改文件
vim server/src/services/sse-event-mapper.ts
```

**Step 4：ThreadManager 集成**
```bash
# 修改文件
vim server/src/services/thread-manager.ts
```

**Step 5：测试验证**
```bash
# 运行测试
bun test server/test/plan-mode.test.ts
```

---

## 7. 兼容性保证

### 7.1 向后兼容

1. **现有事件流不变**：Plan 事件作为新增类型，不影响现有 text/tool_use 等事件
2. **可选功能**：Agent 不使用 TaskCreate 时，Plan 逻辑完全不触发
3. **前端降级**：前端不支持 Plan 事件时，可忽略这些事件

### 7.2 错误处理

1. **PlanManager 异常隔离**：Plan 处理失败不影响主流程
2. **事件丢失容忍**：单个 Plan 事件丢失不影响整体状态
3. **内存限制**：Plan 数量上限，防止内存泄漏

---

## 8. 安全性考虑

1. **租户隔离**：Plan 通过 sessionId 隔离，不跨租户访问
2. **权限控制**：TaskCreate 工具受工具白名单限制
3. **资源限制**：单 Session 的 Plan 数量上限（建议 10）

---

## 9. 性能考虑

1. **内存占用**：单个 Plan 约 1KB，1000 个 Plan 约 1MB
2. **事件频率**：Plan 事件频率与 TaskUpdate 调用频率一致，不会造成 SSE 拥塞
3. **GC 友好**：Session 结束时自动清理 Plan 状态

---

## 10. 验收标准

### 10.1 功能验收

- [ ] Agent 调用 TaskCreate 时触发 `plan_created` 事件
- [ ] Agent 调用 TaskUpdate 时触发 `plan_step` 事件
- [ ] 所有步骤完成时触发 `plan_done` 事件
- [ ] 前端能正确渲染 Plan 进度条

### 10.2 性能验收

- [ ] Plan 事件延迟 < 100ms
- [ ] 内存增长 < 10MB per 1000 Plans
- [ ] 不影响现有 SSE 事件流性能

### 10.3 稳定性验收

- [ ] Plan 处理失败不影响主流程
- [ ] Session 结束后 Plan 状态正确清理
- [ ] 并发场景下 Plan 状态一致性

---

## 11. 附录

### 11.1 前端事件处理示例

```typescript
// 前端 SSE 消费示例
const eventSource = new EventSource('/api/v1/threads/:threadId/chat');

eventSource.addEventListener('message', (e) => {
  const event = JSON.parse(e.data);

  switch (event.type) {
    case 'plan_created':
      renderPlan(event);
      break;
    case 'plan_step':
      updatePlanStep(event);
      break;
    case 'plan_done':
      markPlanDone(event);
      break;
  }
});
```

### 11.2 参考资料

- PM 设计文档：`docs/specs/feature-design-plan-mode.md`
- SDK TaskCreate 工具：`claude-code-best/builtin-tools/tools/TaskCreateTool/`
- SSE 事件映射：`server/src/services/sse-event-mapper.ts`
- ThreadManager：`server/src/services/thread-manager.ts`
