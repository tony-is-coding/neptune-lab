/**
 * Plan 模式类型定义
 *
 * 定义 Plan 数据结构和 SSE 事件类型，用于 Plan 模式的后端实现。
 */

// ===== Plan 数据结构 =====

/**
 * Plan 步骤状态
 */
export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

/**
 * Plan 状态
 */
export type PlanStatus = 'active' | 'completed' | 'failed';

/**
 * Plan 步骤
 */
export interface PlanStep {
    /** 步骤 ID（UUID） */
    id: string;
    /** 步骤序号（从 1 开始） */
    stepNumber: number;
    /** 步骤标题 */
    subject: string;
    /** 步骤描述 */
    description: string;
    /** 进行中描述（如 "正在运行测试"） */
    activeForm?: string;
    /** 步骤状态 */
    status: StepStatus;
    /** 创建时间 */
    createdAt: Date;
    /** 更新时间 */
    updatedAt: Date;
    /** 完成时间 */
    completedAt?: Date;
    /** 自定义元数据 */
    metadata?: Record<string, unknown>;
}

/**
 * Plan（内存结构）
 */
export interface Plan {
    /** Plan ID（UUID） */
    id: string;
    /** 所属 Session ID（对应 Thread 的 sessionId） */
    sessionId: string;
    /** Plan 标题 */
    title: string;
    /** Plan 描述 */
    description?: string;
    /** 步骤列表 */
    steps: PlanStep[];
    /** Plan 状态 */
    status: PlanStatus;
    /** 创建时间 */
    createdAt: Date;
    /** 更新时间 */
    updatedAt: Date;
    /** 完成时间 */
    completedAt?: Date;
    /** 自定义元数据 */
    metadata?: Record<string, unknown>;
}

// ===== SSE Plan 事件类型 =====

/**
 * Plan 创建事件
 * 当 Agent 首次调用 TaskCreate 工具时触发
 */
export interface SSEPlanCreatedEvent {
    type: 'plan_created';
    /** Plan ID */
    planId: string;
    /** Plan 标题 */
    title: string;
    /** 总步骤数 */
    totalSteps: number;
    /** 创建时间（ISO 8601） */
    createdAt: string;
}

/**
 * Plan 步骤更新事件
 * 当步骤状态变化时触发
 */
export interface SSEPlanStepEvent {
    type: 'plan_step';
    /** Plan ID */
    planId: string;
    /** 步骤 ID */
    stepId: string;
    /** 步骤序号 */
    stepNumber: number;
    /** 步骤标题 */
    subject: string;
    /** 步骤状态 */
    status: StepStatus;
    /** 进行中描述 */
    activeForm?: string;
    /** 更新时间（ISO 8601） */
    updatedAt: string;
}

/**
 * Plan 完成事件
 * 当所有步骤完成或 Plan 失败时触发
 */
export interface SSEPlanDoneEvent {
    type: 'plan_done';
    /** Plan ID */
    planId: string;
    /** Plan 状态 */
    status: 'completed' | 'failed';
    /** 完成摘要 */
    summary?: string;
    /** 执行时长（毫秒） */
    duration: number;
    /** 完成时间（ISO 8601） */
    completedAt: string;
}

/**
 * Plan SSE 事件联合类型
 */
export type SSEPlanEvent =
    | SSEPlanCreatedEvent
    | SSEPlanStepEvent
    | SSEPlanDoneEvent;

// ===== SDK TaskCreate/TaskUpdate 事件类型 =====

/**
 * SDK TaskCreate 工具输入参数
 */
export interface TaskCreateInput {
    /** 任务标题 */
    subject: string;
    /** 任务描述 */
    description: string;
    /** 进行中描述 */
    activeForm?: string;
    /** 自定义元数据 */
    metadata?: Record<string, unknown>;
}

/**
 * SDK TaskUpdate 工具输入参数
 */
export interface TaskUpdateInput {
    /** 任务 ID */
    taskId: string;
    /** 任务状态 */
    status: StepStatus;
    /** 进行中描述 */
    activeForm?: string;
}

/**
 * SDK ToolUse 事件（TaskCreate/TaskUpdate 调用时产生）
 */
export interface SDKToolUseEvent {
    type: 'tool_use';
    /** 工具名称 */
    name: string;
    /** 工具输入参数 */
    input: TaskCreateInput | TaskUpdateInput;
    /** 工具调用 ID */
    id: string;
}
