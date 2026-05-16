/**
 * PlanManager 单元测试
 *
 * 验证 PlanManager 的核心功能：
 * - TaskCreate 事件处理（创建 Plan 和步骤）
 * - TaskUpdate 事件处理（更新步骤状态）
 * - Plan 完成检测
 * - 资源限制（最大 Plan 数、最大步骤数）
 */

import {describe, test, expect} from 'bun:test';
import {PlanManager} from '../src/services/plan/PlanManager';

describe('PlanManager', () => {
    describe('TaskCreate 事件处理', () => {
        test('首个 TaskCreate 创建 Plan 并触发 plan_created 事件', () => {
            const manager = new PlanManager('session-123');

            const events = manager.processSDKEvent({
                type: 'tool_use',
                name: 'TaskCreate',
                id: 'tool-1',
                input: {
                    subject: '分析代码',
                    description: '分析 src/ 目录的代码结构',
                },
            });

            // 应该返回 plan_created 和 plan_step 两个事件
            expect(events).toHaveLength(2);
            expect(events[0].type).toBe('plan_created');
            expect(events[0].title).toBe('分析代码');
            expect(events[0].totalSteps).toBe(1);

            expect(events[1].type).toBe('plan_step');
            expect(events[1].subject).toBe('分析代码');
            expect(events[1].status).toBe('pending');
            expect(events[1].stepNumber).toBe(1);
        });

        test('后续 TaskCreate 添加步骤但不创建新 Plan', () => {
            const manager = new PlanManager('session-123');

            // 第一个 TaskCreate
            manager.processSDKEvent({
                type: 'tool_use',
                name: 'TaskCreate',
                id: 'tool-1',
                input: {subject: '步骤 1', description: '第一个步骤'},
            });

            // 第二个 TaskCreate
            const events = manager.processSDKEvent({
                type: 'tool_use',
                name: 'TaskCreate',
                id: 'tool-2',
                input: {subject: '步骤 2', description: '第二个步骤'},
            });

            // 只应该返回 plan_step 事件，不应该有 plan_created
            expect(events).toHaveLength(1);
            expect(events[0].type).toBe('plan_step');
            expect(events[0].subject).toBe('步骤 2');
            expect(events[0].stepNumber).toBe(2);

            // Plan 应该有 2 个步骤
            const plan = manager.getCurrentPlan();
            expect(plan?.steps).toHaveLength(2);
        });

        test('Plan 完成后创建新 Plan', () => {
            const manager = new PlanManager('session-123');

            // 创建 Plan 和步骤
            manager.processSDKEvent({
                type: 'tool_use',
                name: 'TaskCreate',
                id: 'tool-1',
                input: {subject: '步骤 1', description: '第一个步骤'},
            });

            const stepId = manager.getCurrentPlan()!.steps[0]!.id;

            // 完成步骤（应该触发 plan_done）
            const doneEvents = manager.processSDKEvent({
                type: 'tool_use',
                name: 'TaskUpdate',
                id: 'tool-2',
                input: {taskId: stepId, status: 'completed'},
            });

            // 验证 plan_done 事件
            expect(doneEvents.some(e => e.type === 'plan_done')).toBe(true);

            // 此时 currentPlanId 应该为 null
            expect(manager.getCurrentPlan()).toBeNull();

            // 创建新 Plan
            const newEvents = manager.processSDKEvent({
                type: 'tool_use',
                name: 'TaskCreate',
                id: 'tool-3',
                input: {subject: '新 Plan 的步骤', description: '新 Plan'},
            });

            // 应该有 plan_created 事件
            expect(newEvents.some(e => e.type === 'plan_created')).toBe(true);
        });
    });

    describe('TaskUpdate 事件处理', () => {
        test('更新步骤状态为 in_progress', () => {
            const manager = new PlanManager('session-123');

            // 创建步骤
            manager.processSDKEvent({
                type: 'tool_use',
                name: 'TaskCreate',
                id: 'tool-1',
                input: {subject: '步骤 1', description: '第一个步骤'},
            });

            const stepId = manager.getCurrentPlan()!.steps[0]!.id;

            // 更新为 in_progress
            const events = manager.processSDKEvent({
                type: 'tool_use',
                name: 'TaskUpdate',
                id: 'tool-2',
                input: {taskId: stepId, status: 'in_progress', activeForm: '正在执行步骤 1'},
            });

            expect(events).toHaveLength(1);
            expect(events[0].type).toBe('plan_step');
            expect(events[0].status).toBe('in_progress');
            expect(events[0].activeForm).toBe('正在执行步骤 1');

            // 验证内部状态
            const plan = manager.getCurrentPlan();
            expect(plan?.steps[0]?.status).toBe('in_progress');
        });

        test('更新步骤状态为 completed', () => {
            const manager = new PlanManager('session-123');

            // 创建步骤
            manager.processSDKEvent({
                type: 'tool_use',
                name: 'TaskCreate',
                id: 'tool-1',
                input: {subject: '步骤 1', description: '第一个步骤'},
            });

            const stepId = manager.getCurrentPlan()!.steps[0]!.id;

            // 完成步骤（单步骤完成会同时触发 plan_step 和 plan_done）
            const events = manager.processSDKEvent({
                type: 'tool_use',
                name: 'TaskUpdate',
                id: 'tool-2',
                input: {taskId: stepId, status: 'completed'},
            });

            // 应该有 2 个事件：plan_step 和 plan_done
            expect(events.length).toBeGreaterThanOrEqual(1);

            // 第一个事件应该是 plan_step
            const stepEvent = events.find(e => e.type === 'plan_step');
            expect(stepEvent?.status).toBe('completed');

            // 验证内部状态（Plan 完成后 currentPlanId 为 null，使用 getAllPlans）
            const plans = manager.getAllPlans();
            expect(plans).toHaveLength(1);
            expect(plans[0]?.steps[0]?.status).toBe('completed');
            expect(plans[0]?.steps[0]?.completedAt).toBeInstanceOf(Date);
        });

        test('所有步骤完成时触发 plan_done', () => {
            const manager = new PlanManager('session-123');

            // 创建两个步骤
            manager.processSDKEvent({
                type: 'tool_use',
                name: 'TaskCreate',
                id: 'tool-1',
                input: {subject: '步骤 1', description: '第一个步骤'},
            });

            manager.processSDKEvent({
                type: 'tool_use',
                name: 'TaskCreate',
                id: 'tool-2',
                input: {subject: '步骤 2', description: '第二个步骤'},
            });

            const plan = manager.getCurrentPlan();
            const step1Id = plan!.steps[0]!.id;
            const step2Id = plan!.steps[1]!.id;

            // 完成第一个步骤
            const events1 = manager.processSDKEvent({
                type: 'tool_use',
                name: 'TaskUpdate',
                id: 'tool-3',
                input: {taskId: step1Id, status: 'completed'},
            });
            expect(events1.some(e => e.type === 'plan_done')).toBe(false);

            // 完成第二个步骤
            const events2 = manager.processSDKEvent({
                type: 'tool_use',
                name: 'TaskUpdate',
                id: 'tool-4',
                input: {taskId: step2Id, status: 'completed'},
            });
            expect(events2.some(e => e.type === 'plan_done')).toBe(true);

            const doneEvent = events2.find(e => e.type === 'plan_done')!;
            expect(doneEvent.type).toBe('plan_done');
            expect(doneEvent.status).toBe('completed');
            expect(doneEvent.duration).toBeGreaterThanOrEqual(0);
        });

        test('步骤失败时 Plan 状态为 failed', () => {
            const manager = new PlanManager('session-123');

            // 创建步骤
            manager.processSDKEvent({
                type: 'tool_use',
                name: 'TaskCreate',
                id: 'tool-1',
                input: {subject: '步骤 1', description: '第一个步骤'},
            });

            const stepId = manager.getCurrentPlan()!.steps[0]!.id;

            // 步骤失败
            const events = manager.processSDKEvent({
                type: 'tool_use',
                name: 'TaskUpdate',
                id: 'tool-2',
                input: {taskId: stepId, status: 'failed'},
            });

            const doneEvent = events.find(e => e.type === 'plan_done')!;
            expect(doneEvent.status).toBe('failed');
        });
    });

    describe('资源限制', () => {
        test('达到最大步骤数时不添加新步骤', () => {
            const manager = new PlanManager('session-123', {maxSteps: 2});

            // 创建 2 个步骤
            manager.processSDKEvent({
                type: 'tool_use',
                name: 'TaskCreate',
                id: 'tool-1',
                input: {subject: '步骤 1', description: '第一个步骤'},
            });

            manager.processSDKEvent({
                type: 'tool_use',
                name: 'TaskCreate',
                id: 'tool-2',
                input: {subject: '步骤 2', description: '第二个步骤'},
            });

            expect(manager.getCurrentPlan()!.steps).toHaveLength(2);

            // 尝试添加第 3 个步骤
            const events = manager.processSDKEvent({
                type: 'tool_use',
                name: 'TaskCreate',
                id: 'tool-3',
                input: {subject: '步骤 3', description: '第三个步骤'},
            });

            // 不应该返回 plan_step 事件
            expect(events).toHaveLength(0);
            expect(manager.getCurrentPlan()!.steps).toHaveLength(2);
        });

        test('达到最大 Plan 数时删除最旧的 Plan', () => {
            const manager = new PlanManager('session-123', {maxPlans: 2});

            // 创建第一个 Plan
            manager.processSDKEvent({
                type: 'tool_use',
                name: 'TaskCreate',
                id: 'tool-1',
                input: {subject: 'Plan 1 - 步骤 1', description: '第一个 Plan'},
            });

            const plan1Id = manager.getCurrentPlan()!.id;

            // 完成第一个 Plan
            const step1Id = manager.getCurrentPlan()!.steps[0]!.id;
            manager.processSDKEvent({
                type: 'tool_use',
                name: 'TaskUpdate',
                id: 'tool-2',
                input: {taskId: step1Id, status: 'completed'},
            });

            // 创建第二个 Plan
            manager.processSDKEvent({
                type: 'tool_use',
                name: 'TaskCreate',
                id: 'tool-3',
                input: {subject: 'Plan 2 - 步骤 1', description: '第二个 Plan'},
            });

            const plan2Id = manager.getCurrentPlan()!.id;
            expect(manager.getAllPlans()).toHaveLength(2);

            // 完成第二个 Plan
            const step2Id = manager.getCurrentPlan()!.steps[0]!.id;
            manager.processSDKEvent({
                type: 'tool_use',
                name: 'TaskUpdate',
                id: 'tool-4',
                input: {taskId: step2Id, status: 'completed'},
            });

            // 创建第三个 Plan（应该删除第一个 Plan）
            manager.processSDKEvent({
                type: 'tool_use',
                name: 'TaskCreate',
                id: 'tool-5',
                input: {subject: 'Plan 3 - 步骤 1', description: '第三个 Plan'},
            });

            const plans = manager.getAllPlans();
            expect(plans).toHaveLength(2);
            expect(plans.find(p => p.id === plan1Id)).toBeUndefined();
            expect(plans.find(p => p.id === plan2Id)).toBeDefined();
        });
    });

    describe('错误处理', () => {
        test('无效的事件类型不产生 Plan 事件', () => {
            const manager = new PlanManager('session-123');

            const events = manager.processSDKEvent({
                type: 'assistant',
                content: '这是文本消息',
            });

            expect(events).toHaveLength(0);
        });

        test('未知 taskId 的 TaskUpdate 不产生事件', () => {
            const manager = new PlanManager('session-123');

            const events = manager.processSDKEvent({
                type: 'tool_use',
                name: 'TaskUpdate',
                id: 'tool-1',
                input: {taskId: 'unknown-id', status: 'completed'},
            });

            expect(events).toHaveLength(0);
        });

        test('Plan 处理异常不影响后续事件', () => {
            const manager = new PlanManager('session-123');

            // 触发一个会导致错误的事件（例如无效的 input）
            const events1 = manager.processSDKEvent({
                type: 'tool_use',
                name: 'TaskCreate',
                id: 'tool-1',
                input: null as any, // 无效 input
            });

            // 应该返回空数组，不抛出异常
            expect(events1).toEqual([]);

            // 后续正常事件应该能正常处理
            const events2 = manager.processSDKEvent({
                type: 'tool_use',
                name: 'TaskCreate',
                id: 'tool-2',
                input: {subject: '正常步骤', description: '正常描述'},
            });

            expect(events2.length).toBeGreaterThan(0);
        });
    });

    describe('工具方法', () => {
        test('clear() 清理所有 Plan', () => {
            const manager = new PlanManager('session-123');

            // 创建 Plan
            manager.processSDKEvent({
                type: 'tool_use',
                name: 'TaskCreate',
                id: 'tool-1',
                input: {subject: '步骤 1', description: '第一个步骤'},
            });

            expect(manager.getAllPlans()).toHaveLength(1);

            // 清理
            manager.clear();

            expect(manager.getAllPlans()).toHaveLength(0);
            expect(manager.getCurrentPlan()).toBeNull();
        });

        test('getAllPlans() 返回所有 Plan', () => {
            const manager = new PlanManager('session-123');

            manager.processSDKEvent({
                type: 'tool_use',
                name: 'TaskCreate',
                id: 'tool-1',
                input: {subject: '步骤 1', description: '第一个步骤'},
            });

            const plans = manager.getAllPlans();
            expect(plans).toHaveLength(1);
            expect(plans[0]?.title).toBe('步骤 1');
        });
    });
});
