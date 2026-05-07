# Plan 模式支持方案

## 一、现状分析

### 1.1 当前架构

**现有 SSE 事件类型**（`server/src/services/sse-event-mapper.ts`）：

| 事件类型 | 用途 | 当前支持 |
|---------|------|---------|
| `text` | 文本内容 | ✅ |
| `tool_use` | 工具调用 | ✅ |
| `tool_result` | 工具结果 | ✅ |
| `tool_status` | 工具状态更新 | ✅ |
| `error` | 错误消息 | ✅ |
| `done` | 完成 | ✅ |
| `plan_*` | Plan 相关事件 | ❌ 不存在 |

### 1.2 SDK 的 Plan 能力

**关键发现**：`permission-delegate.ts:41-46` 显示，`EnterPlanMode` 和 `ExitPlanMode` 工具被**明确禁用**：

```typescript
this.deniedTools = new Set([
  'Bash',
  'EnterPlanMode',    // 禁用！
  'ExitPlanMode',     // 禁用！
  'EnterPlanModeV2',  // 禁用！
]);
```

**原因分析**：
1. 服务端无头模式，不支持交互式 Plan 确认
2. Plan 模式需要用户干预，与 bypassPermissions 冲突

### 1.3 用户需求

**目标**：Agent 在执行复杂任务前，先制定计划并展示给用户，然后逐步执行。

**典型场景**：
- 用户："帮我分析最近一周的销售数据，生成报告并发送给团队"
- Agent：先生成 Plan → 用户确认 → 逐步执行 → 每步更新状态

---

## 二、解决方案

### 2.1 核心设计思路

**方案 A：基于 TaskCreate 工具的 Plan 模式**

利用 SDK 已有的 `TaskCreate` 工具，让 Agent 在执行前先创建任务列表，前端以 Plan 形式展示。

**优势**：
- 不需要修改 SDK
- 复用现有的任务系统
- 与 Agent 的天然工作方式一致

**方案 B：自定义 Plan 工具（备选）**

如果需要更精细的控制，可以创建自定义 Plan 工具。

---

## 三、方案 A 详细设计（推荐）

### 3.1 后端改动

#### 3.1.1 启用 TaskCreate 工具

**修改**：`server/src/services/permission-delegate.ts`

```typescript
this.deniedTools = new Set([
  'Bash',
  // 移除 EnterPlanMode 相关工具的禁用
  // 'EnterPlanMode',
  // 'ExitPlanMode',
  // 'EnterPlanModeV2',
]);
```

**注意**：这不会让 Agent 进入交互式 Plan 模式，因为 `bypassPermissions: true` 仍然生效。

#### 3.1.2 新增 Plan SSE 事件

**修改**：`server/src/services/sse-event-mapper.ts`

```typescript
// 新增 Plan 事件类型
export interface SSEPlanEvent {
  type: 'plan';
  planId: string;
  steps: Array<{
    id: string;
    subject: string;
    description: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
  }>;
}

// 新增 Plan 步骤更新事件
export interface SSEPlanStepEvent {
  type: 'plan_step';
  planId: string;
  stepId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

// 映射函数
case 'task_created': {
  // SDK 的 TaskCreate 事件
  const tasks = sdkEvent.tasks as Array<{...}>;
  return [{
    type: 'plan',
    planId: sdkEvent.planId || genId(),
    steps: tasks.map(t => ({
      id: t.id,
      subject: t.subject,
      description: t.description,
      status: 'pending',
    })),
  }];
}

case 'task_updated': {
  return [{
    type: 'plan_step',
    planId: sdkEvent.planId,
    stepId: sdkEvent.taskId,
    status: sdkEvent.status,
  }];
}
```

### 3.2 前端改动

#### 3.2.1 类型定义

**修改**：`web/src/types/chat.ts`

```typescript
// 新增 Plan 相关类型
export interface Plan {
  id: string;
  steps: PlanStep[];
  createdAt: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface PlanStep {
  id: string;
  subject: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: string;  // 步骤执行结果
  startedAt?: number;
  completedAt?: number;
}

// 扩展 MessageBlock
export type MessageBlock =
  | // ... 现有类型
  | { type: 'plan'; plan: Plan }
  | { type: 'plan_step'; planId: string; stepId: string; status: PlanStep['status'] };
```

#### 3.2.2 Plan 展示组件

**新建**：`web/src/components/chat/PlanBlock.tsx`

```typescript
export function PlanBlock({ plan, isStreaming }: { plan: Plan; isStreaming?: boolean }) {
  return (
    <div className="plan-container border rounded-lg p-4 bg-surface-variant">
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-np-primary">view_timeline</span>
        <span className="font-semibold text-charcoal">执行计划</span>
        {isStreaming && <span className="text-xs text-text-muted">执行中...</span>}
      </div>

      <div className="space-y-2">
        {plan.steps.map((step, index) => (
          <PlanStepItem key={step.id} step={step} index={index} />
        ))}
      </div>
    </div>
  );
}

function PlanStepItem({ step, index }: { step: PlanStep; index: number }) {
  const statusIcon = {
    pending: 'radio_button_unchecked',
    in_progress: 'pending',
    completed: 'check_circle',
    failed: 'error',
  }[step.status];

  const statusColor = {
    pending: 'text-text-muted',
    in_progress: 'text-np-primary animate-spin',
    completed: 'text-green-600',
    failed: 'text-red-600',
  }[step.status];

  return (
    <div className="flex items-start gap-3 p-2 rounded hover:bg-surface-container-low transition">
      <span className={`material-symbols-outlined text-[20px] ${statusColor}`}>
        {statusIcon}
      </span>
      <div className="flex-1">
        <div className="font-medium text-charcoal text-sm">{step.subject}</div>
        {step.description && (
          <div className="text-xs text-text-muted mt-1">{step.description}</div>
        )}
        {step.result && (
          <div className="text-xs text-charcoal mt-2 p-2 bg-surface-container-highest rounded">
            {step.result}
          </div>
        )}
      </div>
    </div>
  );
}
```

#### 3.2.3 useChatMessages Hook 更新

**修改**：`web/src/hooks/useChatMessages.ts`

```typescript
const [plansByThread, setPlansByThread] = useState<Record<string, Plan[]>>({});

const getPlans = useCallback((threadId: string) => {
  return plansByThread[threadId] || [];
}, [plansByThread]);

// 在 onEvent 中处理 Plan 事件
onEvent: (event) => {
  // ... 现有处理

  if (event.type === 'plan') {
    const planData = event.data as Plan;
    setPlansByThread(prev => ({
      ...prev,
      [threadId]: [...(prev[threadId] || []), planData],
    }));
  }

  if (event.type === 'plan_step') {
    const { planId, stepId, status } = event.data;
    setPlansByThread(prev => {
      const plans = prev[threadId] || [];
      return {
        ...prev,
        [threadId]: plans.map(plan =>
          plan.id === planId
            ? {
                ...plan,
                steps: plan.steps.map(step =>
                  step.id === stepId ? { ...step, status } : step
                ),
              }
            : plan
        ),
      };
    });
  }
},
```

### 3.3 Agent SystemPrompt 引导

**目标**：引导 Agent 在复杂任务时先创建 Plan。

**修改 Agent 模板的 systemPrompt 模板**：

```markdown
你是一个专业的 AI 助手。在执行复杂任务时，请遵循以下工作流程：

1. **理解任务**：首先理解用户的需求和目标
2. **制定计划**：对于多步骤任务，使用 TaskCreate 工具创建任务列表
3. **逐步执行**：按照计划逐步执行，每完成一个任务就更新其状态
4. **汇报结果**：所有任务完成后，向用户汇报最终结果

## 创建任务的示例

当用户要求"分析销售数据并生成报告"时，你应该：

1. 首先创建任务列表：
   - TaskCreate: "收集销售数据"
   - TaskCreate: "分析数据趋势"
   - TaskCreate: "生成可视化图表"
   - TaskCreate: "撰写分析报告"

2. 然后逐个执行并更新状态
```

---

## 四、交互流程

### 4.1 理想流程

```
用户：帮我分析销售数据并生成报告
  ↓
Agent：收到请求
  ↓
Agent：调用 TaskCreate 创建 3 个任务
  ↓
前端：显示 Plan 展示组件（3 个 pending 任务）
  ↓
Agent：开始执行第 1 个任务
  ↓
前端：第 1 个任务状态变为 in_progress（加载动画）
  ↓
Agent：第 1 个任务完成
  ↓
前端：第 1 个任务状态变为 completed（绿色勾）
  ↓
... 重复执行后续任务 ...
  ↓
Agent：所有任务完成，生成最终回复
  ↓
前端：显示最终回复，Plan 组件保持展示（可折叠）
```

### 4.2 状态图

```
Plan 状态：
  pending → running → completed
            ↓
          failed

Step 状态：
  pending → in_progress → completed
            ↓
          failed
```

---

## 五、实施计划

### Phase 1：后端 Plan 事件支持（2 天）

1. **修改 `sse-event-mapper.ts`**，添加 Plan 事件类型和映射逻辑
2. **验证 SDK 事件**：确认 SDK 是否发送 `task_created` / `task_updated` 事件
3. **编写测试**：测试 Plan 事件的生成和映射

### Phase 2：前端 Plan 展示（2-3 天）

1. **创建 PlanBlock 组件**
2. **创建 PlanStepItem 组件**
3. **修改 AssistantMessage**，支持 Plan block 渲染
4. **更新 useChatMessages**，管理 Plan 状态

### Phase 3：Agent Prompt 优化（1 天）

1. **更新 Agent 模板 systemPrompt**，引导 Plan 行为
2. **A/B 测试**：对比有/无 Plan 引导的效果

### Phase 4：高级功能（可选，3-5 天）

1. **Plan 编辑**：用户可以修改 Plan（添加/删除/重排序步骤）
2. **Plan 确认**：Agent 执行前等待用户确认 Plan
3. **Plan 导出**：将 Plan 导出为 Markdown/JSON
4. **Plan 模板**：预定义常用 Plan 模板

---

## 六、数据结构

### 6.1 SSE 事件

```typescript
// Plan 创建事件
{
  type: 'plan';
  data: {
    planId: string;
    steps: Array<{
      id: string;
      subject: string;
      description: string;
      status: 'pending';
    }>;
  };
}

// Plan 步骤更新事件
{
  type: 'plan_step';
  data: {
    planId: string;
    stepId: string;
    status: 'in_progress' | 'completed' | 'failed';
    result?: string;  // 可选的步骤结果
  };
}
```

### 6.2 前端类型

```typescript
interface Plan {
  id: string;
  steps: PlanStep[];
  createdAt: number;
  updatedAt: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

interface PlanStep {
  id: string;
  subject: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: string;
  startedAt?: number;
  completedAt?: number;
  error?: string;
}
```

---

## 七、验收标准

### 7.1 功能验收

1. **Plan 自动创建**：复杂任务时 Agent 自动创建 Plan
2. **Plan 展示**：Plan 以清晰的卡片形式展示
3. **状态更新**：Plan 步骤状态实时更新
4. **完成标识**：Plan 完成后有明确的视觉反馈

### 7.2 用户体验验收

1. **可预测性**：用户在 Agent 开始工作前就能看到计划
2. **进度感知**：用户清楚当前执行到哪一步
3. **透明度**：失败的任务有明确的错误信息
4. **可折叠**：长 Plan 可以折叠以节省空间

### 7.3 边界场景

1. **Plan 执行中失败**：显示错误，允许用户选择继续或中止
2. **用户中断**：用户中断时 Plan 标记为"已取消"
3. **网络断开**：重连后 Plan 状态能恢复

---

## 八、风险与备选方案

### 风险 1：SDK 不发送 task_created 事件

**验证**：需要先测试 SDK 是否在调用 TaskCreate 时发送对应事件。

**备选**：
- 监听 `tool_use` 事件，检测 TaskCreate 工具调用
- 解析工具调用参数，提取任务信息

### 风险 2：Agent 不遵循 Plan 引导

**应对**：
- 优化 systemPrompt，增加更明确的引导
- 使用 few-shot 示例
- 考虑强制模式：前 N 次回复必须包含 Plan

### 风险 3：Plan 与工具调用混淆

**场景**：Agent 可能跳过 Plan，直接调用工具。

**应对**：
- Plan 是可选的，不强制
- 在 UI 上区分"有 Plan 的任务"和"直接执行的任务"

---

## 九、后续优化方向

1. **Plan 模板库**：预定义常见任务的 Plan 模板
2. **Plan 分享**：将 Plan 导出并分享给其他用户
3. **Plan 历史**：保存历史 Plan，便于复用
4. **Plan 协作**：多人协作编辑 Plan
5. **Plan 执行策略**：支持串行/并行执行策略
