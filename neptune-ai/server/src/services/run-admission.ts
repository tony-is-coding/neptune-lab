import {createLogger} from '../utils/logger.js';
import {ApiError} from '../utils/api-error.js';
import {costAggregator, type TenantQuotaGateResult} from './cost.js';
import {policyDecisionService} from './policy-decision.js';
import {auditEventService} from './audit.js';

const log = createLogger('run-admission');

export interface RunAdmissionThreadRef {
    id: string;
    tenantId: string;
    userId: string;
    templateId: string | null;
}

export interface EnforceThreadDispatchInput {
    thread: RunAdmissionThreadRef;
    requestId?: string;
}

interface RunAdmissionCostDependency {
    checkTenantQuotaGate(tenantId: string): Promise<TenantQuotaGateResult>;
}

interface RunAdmissionPolicyDependency {
    record(input: {
        tenantId: string;
        runId?: string | null;
        requestId?: string;
        policyType: string;
        subjectType: string;
        subjectId: string;
        decision: 'allow' | 'deny' | 'review_required';
        reason: string;
        details?: Record<string, unknown>;
    }): Promise<unknown>;
}

interface RunAdmissionAuditDependency {
    record(input: {
        tenantId: string;
        userId?: string | null;
        requestId?: string;
        action: string;
        resourceType: string;
        resourceId: string;
        outcome?: string;
        metadata?: Record<string, unknown>;
    }): Promise<unknown>;
}

export interface RunAdmissionServiceDeps {
    cost?: RunAdmissionCostDependency;
    policyDecision?: RunAdmissionPolicyDependency;
    auditEvent?: RunAdmissionAuditDependency;
}

export class RunAdmissionService {
    private readonly cost: RunAdmissionCostDependency;
    private readonly policyDecision: RunAdmissionPolicyDependency;
    private readonly auditEvent: RunAdmissionAuditDependency;

    constructor(deps: RunAdmissionServiceDeps = {}) {
        this.cost = deps.cost ?? costAggregator;
        this.policyDecision = deps.policyDecision ?? policyDecisionService;
        this.auditEvent = deps.auditEvent ?? auditEventService;
    }

    async enforceThreadDispatch(input: EnforceThreadDispatchInput): Promise<void> {
        const {thread, requestId} = input;
        const gate = await this.cost.checkTenantQuotaGate(thread.tenantId);
        if (gate.allowed) return;

        const details = {
            reason: gate.reason,
            quota: gate.quota,
            usage: gate.usage,
        };
        const ctx = {
            threadId: thread.id,
            tenantId: thread.tenantId,
            userId: thread.userId,
            agentId: thread.templateId,
            requestId,
        };

        await this.policyDecision.record({
            tenantId: thread.tenantId,
            runId: null,
            requestId,
            policyType: 'quota',
            subjectType: 'thread',
            subjectId: thread.id,
            decision: 'deny',
            reason: gate.reason === 'CONCURRENT_SESSION_LIMIT'
                ? '租户并发运行数已达到上限'
                : '租户 token 配额不足',
            details: {
                agentId: thread.templateId,
                ...details,
            },
        });

        await this.auditEvent.record({
            tenantId: thread.tenantId,
            userId: thread.userId,
            requestId,
            action: 'quota.blocked',
            resourceType: 'thread',
            resourceId: thread.id,
            outcome: 'failure',
            metadata: {
                agentId: thread.templateId,
                ...details,
            },
        });

        log.warn('Tenant quota gate blocked dispatch', {
            ...ctx,
            ...details,
        });

        throw new ApiError(429, {
            error: 'QUOTA_EXCEEDED',
            message: '租户配额不足',
            requestId,
            details,
        });
    }
}

export const runAdmissionService = new RunAdmissionService();
