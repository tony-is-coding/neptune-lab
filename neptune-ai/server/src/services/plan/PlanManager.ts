/**
 * PlanManager — Plan 状态管理和事件转换
 *
 * 职责：
 * 1. 监听 SDK 的 TaskCreate/TaskUpdate 事件（通过 tool_use）
 * 2. 维护 Plan 状态（内存）
 * 3. 将 SDK 事件转换为 SSE Plan 事件
 * 4. 计算进度并触发状态变更
 *
 * Phase 1：内存存储，自动执行（不需要用户确认）
 */

import type {
  Plan,
  PlanStep,
  SSEPlanEvent,
  SSEPlanCreatedEvent,
  SSEPlanStepEvent,
  SSEPlanDoneEvent,
  TaskCreateInput,
  TaskUpdateInput,
  StepStatus,
} from './types';

/**
 * PlanManager 配置
 */
export interface PlanManagerConfig {
  /** 单个 Session 最多允许的 Plan 数量（防止内存泄漏） */
  maxPlans?: number;
  /** 单个 Plan 最多允许的步骤数 */
  maxSteps?: number;
}

/**
 * PlanManager — Plan 状态管理器
 */
export class PlanManager {
  private plans: Map<string, Plan> = new Map();
  private currentPlanId: string | null = null;
  private stepIdToPlanId: Map<string, string> = new Map(); // stepId -> planId 映射
  private maxPlans: number;
  private maxSteps: number;

  constructor(
    private sessionId: string,
    config?: PlanManagerConfig,
  ) {
    this.maxPlans = config?.maxPlans ?? 10;
    this.maxSteps = config?.maxSteps ?? 50;
  }

  /**
   * 处理 SDK 事件，返回 SSE Plan 事件数组
   *
   * @param sdkEvent SDK 原始事件
   * @returns SSE Plan 事件数组（可能为空）
   */
  processSDKEvent(sdkEvent: Record<string, unknown>): SSEPlanEvent[] {
    try {
      // 1. 识别 TaskCreate 工具调用
      if (this.isTaskCreateEvent(sdkEvent)) {
        return this.handleTaskCreate(sdkEvent);
      }

      // 2. 识别 TaskUpdate 工具调用
      if (this.isTaskUpdateEvent(sdkEvent)) {
        return this.handleTaskUpdate(sdkEvent);
      }

      return [];
    } catch (error) {
      // Plan 处理失败不影响主流程，记录错误但不抛出
      console.error('[PlanManager] 处理事件失败:', error);
      return [];
    }
  }

  /**
   * 判断是否为 TaskCreate 工具调用
   */
  private isTaskCreateEvent(event: Record<string, unknown>): boolean {
    return (
      event.type === 'tool_use' &&
      (event.name as string) === 'TaskCreate' &&
      event.input != null
    );
  }

  /**
   * 判断是否为 TaskUpdate 工具调用
   */
  private isTaskUpdateEvent(event: Record<string, unknown>): boolean {
    return (
      event.type === 'tool_use' &&
      (event.name as string) === 'TaskUpdate' &&
      event.input != null
    );
  }

  /**
   * 处理 TaskCreate 工具调用
   */
  private handleTaskCreate(event: Record<string, unknown>): SSEPlanEvent[] {
    const events: SSEPlanEvent[] = [];
    const input = event.input as TaskCreateInput;

    // 如果还没有当前 Plan，创建一个新的
    let plan: Plan;
    if (!this.currentPlanId) {
      plan = this.createPlan(input.subject, input.description);
      this.currentPlanId = plan.id;
      // 不立即发送 plan_created，等添加第一个步骤后再发送
    } else {
      plan = this.plans.get(this.currentPlanId!)!;
      if (!plan) {
        console.error('[PlanManager] 当前 Plan 不存在');
        return events;
      }
    }

    // 检查步骤数限制
    if (plan.steps.length >= this.maxSteps) {
      console.warn(`[PlanManager] Plan ${plan.id} 已达到最大步骤数 ${this.maxSteps}`);
      return events;
    }

    const step = this.addStep(plan, input);

    // 如果是第一个步骤，发送 plan_created 事件（此时 totalSteps 为 1）
    if (plan.steps.length === 1) {
      events.push(this.toPlanCreatedEvent(plan));
    }

    events.push(this.toPlanStepEvent(step, plan.id));

    return events;
  }

  /**
   * 处理 TaskUpdate 工具调用
   */
  private handleTaskUpdate(event: Record<string, unknown>): SSEPlanEvent[] {
    const input = event.input as TaskUpdateInput;

    // 通过 taskId (stepId) 查找对应的 Plan
    const planId = this.stepIdToPlanId.get(input.taskId);
    if (!planId) {
      console.warn(`[PlanManager] 找不到步骤 ${input.taskId} 对应的 Plan`);
      return [];
    }

    const plan = this.plans.get(planId);
    if (!plan) {
      console.warn(`[PlanManager] Plan ${planId} 不存在`);
      return [];
    }

    // 更新步骤状态
    const step = plan.steps.find(s => s.id === input.taskId);
    if (!step) {
      console.warn(`[PlanManager] 步骤 ${input.taskId} 不存在`);
      return [];
    }

    // 更新步骤
    this.updateStep(step, input.status, input.activeForm);
    plan.updatedAt = new Date();

    const events: SSEPlanEvent[] = [this.toPlanStepEvent(step, plan.id)];

    // 检查 Plan 是否完成
    if (this.isPlanCompleted(plan)) {
      this.finalizePlan(plan);
      events.push(this.toPlanDoneEvent(plan));
    }

    return events;
  }

  /**
   * 创建新 Plan
   */
  private createPlan(title: string, description?: string): Plan {
    // 检查 Plan 数量限制
    if (this.plans.size >= this.maxPlans) {
      // 删除最旧的 Plan
      const oldestPlanId = this.plans.keys().next().value;
      if (oldestPlanId) {
        this.deletePlan(oldestPlanId);
      }
    }

    const plan: Plan = {
      id: this.generateId(),
      sessionId: this.sessionId,
      title,
      description,
      steps: [],
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.plans.set(plan.id, plan);
    return plan;
  }

  /**
   * 添加步骤到 Plan
   */
  private addStep(plan: Plan, input: TaskCreateInput): PlanStep {
    const step: PlanStep = {
      id: this.generateId(),
      stepNumber: plan.steps.length + 1,
      subject: input.subject,
      description: input.description,
      activeForm: input.activeForm,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: input.metadata,
    };

    plan.steps.push(step);
    plan.updatedAt = new Date();

    // 建立 stepId -> planId 映射
    this.stepIdToPlanId.set(step.id, plan.id);

    return step;
  }

  /**
   * 更新步骤状态
   */
  private updateStep(
    step: PlanStep,
    status: StepStatus,
    activeForm?: string,
  ): void {
    step.status = status;
    step.updatedAt = new Date();

    if (activeForm) {
      step.activeForm = activeForm;
    }

    if (status === 'completed' || status === 'failed') {
      step.completedAt = new Date();
    }
  }

  /**
   * 判断 Plan 是否完成
   */
  private isPlanCompleted(plan: Plan): boolean {
    if (plan.steps.length === 0) return false;
    return plan.steps.every(
      s => s.status === 'completed' || s.status === 'failed',
    );
  }

  /**
   * 完成 Plan
   */
  private finalizePlan(plan: Plan): void {
    plan.status = plan.steps.some(s => s.status === 'failed')
      ? 'failed'
      : 'completed';
    plan.completedAt = new Date();
    plan.updatedAt = new Date();
    this.currentPlanId = null;
  }

  /**
   * 删除 Plan
   */
  private deletePlan(planId: string): void {
    const plan = this.plans.get(planId);
    if (plan) {
      // 清理 stepId -> planId 映射
      for (const step of plan.steps) {
        this.stepIdToPlanId.delete(step.id);
      }
    }
    this.plans.delete(planId);
  }

  /**
   * 转换为 plan_created 事件
   */
  private toPlanCreatedEvent(plan: Plan): SSEPlanCreatedEvent {
    return {
      type: 'plan_created',
      planId: plan.id,
      title: plan.title,
      totalSteps: plan.steps.length,
      createdAt: plan.createdAt.toISOString(),
    };
  }

  /**
   * 转换为 plan_step 事件
   */
  private toPlanStepEvent(step: PlanStep, planId: string): SSEPlanStepEvent {
    return {
      type: 'plan_step',
      planId,
      stepId: step.id,
      stepNumber: step.stepNumber,
      subject: step.subject,
      status: step.status,
      activeForm: step.activeForm,
      updatedAt: step.updatedAt.toISOString(),
    };
  }

  /**
   * 转换为 plan_done 事件
   */
  private toPlanDoneEvent(plan: Plan): SSEPlanDoneEvent {
    const duration = plan.completedAt && plan.createdAt
      ? plan.completedAt.getTime() - plan.createdAt.getTime()
      : 0;

    return {
      type: 'plan_done',
      planId: plan.id,
      status: plan.status,
      summary: plan.description,
      duration,
      completedAt: plan.completedAt?.toISOString() || new Date().toISOString(),
    };
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * 获取当前 Plan（用于测试）
   */
  getCurrentPlan(): Plan | null {
    return this.currentPlanId ? this.plans.get(this.currentPlanId!) || null : null;
  }

  /**
   * 获取所有 Plan（用于测试）
   */
  getAllPlans(): Plan[] {
    return Array.from(this.plans.values());
  }

  /**
   * 清理所有 Plan（用于测试或 Session 结束）
   */
  clear(): void {
    this.plans.clear();
    this.stepIdToPlanId.clear();
    this.currentPlanId = null;
  }
}
