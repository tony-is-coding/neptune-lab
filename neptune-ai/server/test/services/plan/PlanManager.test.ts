/**
 * PlanManager 单元测试
 *
 * 测试 Plan 状态管理和 SDK 事件到 SSE Plan 事件的转换逻辑。
 */

import {describe, it, expect, beforeEach} from 'bun:test';
import {randomUUID} from 'crypto';
import {PlanManager} from '../../../src/services/plan/PlanManager';
import type {TaskCreateInput, TaskUpdateInput, SSEPlanEvent} from '../../../src/services/plan/types';

describe('PlanManager', () => {
    let planManager: PlanManager;
    let sessionId: string;

    beforeEach(() => {
        sessionId = randomUUID();
        planManager = new PlanManager(sessionId);
    });

    describe('TaskCreate 事件处理', () => {
        it('首次 TaskCreate 创建 Plan 并返回 plan_created 事件', () => {
            const taskCreateEvent = {
                type: 'tool_use',
                name: 'TaskCreate',
                id: randomUUID(),
                input: {
                    subject: '分析代码',
                    description: '分析 src/ 目录的代码结构',
                    activeForm: '正在分析代码',
                } as TaskCreateInput,
            };

            const events = planManager.processSDKEvent(taskCreateEvent);

            expect(events).toHaveLength(2);
            expect(events[0].type).toBe('plan_created');
            expect(events[0].planId).toBeDefined();
            expect(events[0].title).toBe('分析代码');
            expect(events[0].totalSteps).toBe(1);

            expect(events[1].type).toBe('plan_step');
            expect(events[1].planId).toBe(events[0].planId);
            expect(events[1].stepNumber).toBe(1);
            expect(events[1].subject).toBe('分析代码');
            expect(events[1].status).toBe('pending');
        });

        it('后续 TaskCreate 添加步骤并返回 plan_step 事件', () => {
            // 首先创建 Plan
            const firstEvent = {
                type: 'tool_use',
                name: 'TaskCreate',
                id: randomUUID(),
                input: {
                    subject: '步骤1',
                    description: '第一个步骤',
                } as TaskCreateInput,
            };
            planManager.processSDKEvent(firstEvent);

            // 添加第二个步骤
            const secondEvent = {
                type: 'tool_use',
                name: 'TaskCreate',
                id: randomUUID(),
                input: {
                    subject: '步骤2',
                    description: '第二个步骤',
                } as TaskCreateInput,
            };
            const events = planManager.processSDKEvent(secondEvent);

            expect(events).toHaveLength(1);
            expect(events[0].type).toBe('plan_step');
            expect(events[0].stepNumber).toBe(2);
            expect(events[0].subject).toBe('步骤2');
        });

        it('非 TaskCreate 事件返回空数组', () => {
            const otherEvent = {
                type: 'tool_use',
                name: 'Bash',
                id: randomUUID(),
                input: {},
            };

            const events = planManager.processSDKEvent(otherEvent);

            expect(events).toHaveLength(0);
        });
    });

    describe('TaskUpdate 事件处理', () => {
        let planId: string;
        let stepId: string;

        beforeEach(() => {
            // 创建 Plan 和步骤
            const taskCreateEvent = {
                type: 'tool_use',
                name: 'TaskCreate',
                id: randomUUID(),
                input: {
                    subject: '测试任务',
                    description: '测试描述',
                } as TaskCreateInput,
            };
            const events = planManager.processSDKEvent(taskCreateEvent);
            planId = (events[0] as SSEPlanEvent & { type: 'plan_created' }).planId;
            stepId = (events[1] as SSEPlanEvent & { type: 'plan_step' }).stepId;
        });

        it('TaskUpdate 更新步骤状态并返回 plan_step 事件', () => {
            const taskUpdateEvent = {
                type: 'tool_use',
                name: 'TaskUpdate',
                id: randomUUID(),
                input: {
                    taskId: stepId,
                    status: 'in_progress',
                } as TaskUpdateInput,
            };

            const events = planManager.processSDKEvent(taskUpdateEvent);

            expect(events).toHaveLength(1);
            expect(events[0].type).toBe('plan_step');
            expect((events[0] as SSEPlanEvent & { type: 'plan_step' }).status).toBe('in_progress');
        });

        it('所有步骤完成时返回 plan_done 事件', () => {
            // 标记步骤为 in_progress
            planManager.processSDKEvent({
                type: 'tool_use',
                name: 'TaskUpdate',
                id: randomUUID(),
                input: {
                    taskId: stepId,
                    status: 'in_progress',
                } as TaskUpdateInput,
            });

            // 标记步骤为 completed
            const events = planManager.processSDKEvent({
                type: 'tool_use',
                name: 'TaskUpdate',
                id: randomUUID(),
                input: {
                    taskId: stepId,
                    status: 'completed',
                } as TaskUpdateInput,
            });

            expect(events).toHaveLength(2);
            expect(events[0].type).toBe('plan_step');
            expect(events[1].type).toBe('plan_done');
            expect((events[1] as SSEPlanEvent & { type: 'plan_done' }).status).toBe('completed');
        });

        it('步骤失败时返回 plan_done 事件并标记为 failed', () => {
            planManager.processSDKEvent({
                type: 'tool_use',
                name: 'TaskUpdate',
                id: randomUUID(),
                input: {
                    taskId: stepId,
                    status: 'in_progress',
                } as TaskUpdateInput,
            });

            const events = planManager.processSDKEvent({
                type: 'tool_use',
                name: 'TaskUpdate',
                id: randomUUID(),
                input: {
                    taskId: stepId,
                    status: 'failed',
                } as TaskUpdateInput,
            });

            expect(events).toHaveLength(2);
            expect(events[1].type).toBe('plan_done');
            expect((events[1] as SSEPlanEvent & { type: 'plan_done' }).status).toBe('failed');
        });
    });

    describe('Plan 状态管理', () => {
        it('getPlan 返回正确的 Plan 对象', () => {
            const taskCreateEvent = {
                type: 'tool_use',
                name: 'TaskCreate',
                id: randomUUID(),
                input: {
                    subject: '测试 Plan',
                    description: '测试描述',
                } as TaskCreateInput,
            };
            planManager.processSDKEvent(taskCreateEvent);

            const plan = planManager.getCurrentPlan();
            expect(plan).toBeDefined();
            expect(plan?.sessionId).toBe(sessionId);
            expect(plan?.title).toBe('测试 Plan');
            expect(plan?.steps).toHaveLength(1);
        });

        it('getCurrentPlan 在无 Plan 时返回 null', () => {
            const plan = planManager.getCurrentPlan();
            expect(plan).toBeNull();
        });

        it('clear 清除当前 Plan 状态', () => {
            // 创建 Plan
            planManager.processSDKEvent({
                type: 'tool_use',
                name: 'TaskCreate',
                id: randomUUID(),
                input: {
                    subject: '测试',
                    description: '测试',
                } as TaskCreateInput,
            });

            expect(planManager.getCurrentPlan()).toBeDefined();

            // Clear
            planManager.clear();
            expect(planManager.getCurrentPlan()).toBeNull();
        });
    });

    describe('边界情况', () => {
        it('TaskUpdate 引用不存在的 taskId 时返回空数组', () => {
            const taskUpdateEvent = {
                type: 'tool_use',
                name: 'TaskUpdate',
                id: randomUUID(),
                input: {
                    taskId: 'non-existent-id',
                    status: 'in_progress',
                } as TaskUpdateInput,
            };

            const events = planManager.processSDKEvent(taskUpdateEvent);

            expect(events).toHaveLength(0);
        });

        it('多步骤 Plan 正确计算进度', () => {
            // 创建 3 个步骤
            for (let i = 1; i <= 3; i++) {
                planManager.processSDKEvent({
                    type: 'tool_use',
                    name: 'TaskCreate',
                    id: randomUUID(),
                    input: {
                        subject: `步骤${i}`,
                        description: `描述${i}`,
                    } as TaskCreateInput,
                });
            }

            const plan = planManager.getCurrentPlan();
            expect(plan?.steps).toHaveLength(3);

            // 标记第一个步骤完成
            const stepId = plan!.steps[0].id;
            planManager.processSDKEvent({
                type: 'tool_use',
                name: 'TaskUpdate',
                id: randomUUID(),
                input: {
                    taskId: stepId,
                    status: 'completed',
                } as TaskUpdateInput,
            });

            // Plan 仍应处于 active 状态（还有未完成的步骤）
            const updatedPlan = planManager.getCurrentPlan();
            expect(updatedPlan?.status).toBe('active');
        });
    });
});
