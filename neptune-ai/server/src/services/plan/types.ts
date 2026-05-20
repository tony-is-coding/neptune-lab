/**
 * Plan 模式类型定义
 *
 * 定义 Plan 数据结构和 SSE 事件类型，用于 Plan 模式的后端实现。
 */

import type {
    ChatPlanCreatedEvent,
    ChatPlanDoneEvent,
    ChatPlanStepEvent,
    PlanTaskStatus,
} from '@shared/neptune-ai';

// ===== Plan 数据结构 =====

/**
 * Plan 步骤状态
 */
export type StepStatus = PlanTaskStatus;

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

export type SSEPlanCreatedEvent = ChatPlanCreatedEvent;
export type SSEPlanStepEvent = ChatPlanStepEvent;
export type SSEPlanDoneEvent = ChatPlanDoneEvent;
export type SSEPlanEvent = SSEPlanCreatedEvent | SSEPlanStepEvent | SSEPlanDoneEvent;

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
