import {describe, expect, test} from 'bun:test';
import {ApiError} from '../src/utils/api-error';
import {RunAdmissionService} from '../src/services/run-admission';

describe('RunAdmissionService', () => {
    test('配额拒绝时写入策略与审计事实，并返回稳定错误信封', async () => {
        const policyRecords: Array<Record<string, unknown>> = [];
        const auditRecords: Array<Record<string, unknown>> = [];
        const service = new RunAdmissionService({
            cost: {
                async checkTenantQuotaGate() {
                    return {
                        allowed: false,
                        reason: 'TOKEN_QUOTA_EXCEEDED',
                        quota: {maxTokensPerDay: 0, maxConcurrentSessions: 10},
                        usage: {totalTokensToday: 12, runningSessions: 0},
                    };
                },
            },
            policyDecision: {
                async record(input) {
                    policyRecords.push(input);
                    return input as never;
                },
            },
            auditEvent: {
                async record(input) {
                    auditRecords.push(input);
                    return input as never;
                },
            },
        });

        await expect(service.enforceThreadDispatch({
            thread: {
                id: 'thread-1',
                tenantId: 'tenant-1',
                userId: 'user-1',
                templateId: 'agent-1',
            },
            requestId: 'req-1',
        })).rejects.toThrow(ApiError);

        expect(policyRecords).toHaveLength(1);
        expect(policyRecords[0]).toMatchObject({
            tenantId: 'tenant-1',
            runId: null,
            requestId: 'req-1',
            policyType: 'quota',
            subjectType: 'thread',
            subjectId: 'thread-1',
            decision: 'deny',
            reason: '租户 token 配额不足',
        });

        expect(auditRecords).toHaveLength(1);
        expect(auditRecords[0]).toMatchObject({
            tenantId: 'tenant-1',
            userId: 'user-1',
            requestId: 'req-1',
            action: 'quota.blocked',
            resourceType: 'thread',
            resourceId: 'thread-1',
            outcome: 'failure',
        });

        try {
            await service.enforceThreadDispatch({
                thread: {
                    id: 'thread-1',
                    tenantId: 'tenant-1',
                    userId: 'user-1',
                    templateId: 'agent-1',
                },
                requestId: 'req-2',
            });
        } catch (error) {
            expect(error).toBeInstanceOf(ApiError);
            expect((error as ApiError).statusCode).toBe(429);
            expect((error as ApiError).envelope).toMatchObject({
                error: 'QUOTA_EXCEEDED',
                message: '租户配额不足',
                requestId: 'req-2',
                details: {
                    reason: 'TOKEN_QUOTA_EXCEEDED',
                    quota: {maxTokensPerDay: 0, maxConcurrentSessions: 10},
                    usage: {totalTokensToday: 12, runningSessions: 0},
                },
            });
        }
    });

    test('配额允许时不写策略和审计事实', async () => {
        let policyWriteCount = 0;
        let auditWriteCount = 0;
        const service = new RunAdmissionService({
            cost: {
                async checkTenantQuotaGate() {
                    return {
                        allowed: true,
                        quota: {maxTokensPerDay: 100, maxConcurrentSessions: 2},
                        usage: {totalTokensToday: 1, runningSessions: 0},
                    };
                },
            },
            policyDecision: {
                async record(input) {
                    policyWriteCount += 1;
                    return input as never;
                },
            },
            auditEvent: {
                async record(input) {
                    auditWriteCount += 1;
                    return input as never;
                },
            },
        });

        await service.enforceThreadDispatch({
            thread: {
                id: 'thread-2',
                tenantId: 'tenant-1',
                userId: 'user-1',
                templateId: 'agent-1',
            },
            requestId: 'req-allow',
        });

        expect(policyWriteCount).toBe(0);
        expect(auditWriteCount).toBe(0);
    });

    test('配额拒绝事实写入失败时不静默返回配额错误', async () => {
        const service = new RunAdmissionService({
            cost: {
                async checkTenantQuotaGate() {
                    return {
                        allowed: false,
                        reason: 'TOKEN_QUOTA_EXCEEDED',
                        quota: {maxTokensPerDay: 0, maxConcurrentSessions: 2},
                        usage: {totalTokensToday: 20, runningSessions: 0},
                    };
                },
            },
            policyDecision: {
                async record() {
                    throw new Error('policy store unavailable');
                },
            },
            auditEvent: {
                async record(input) {
                    return input as never;
                },
            },
        });

        await expect(service.enforceThreadDispatch({
            thread: {
                id: 'thread-policy-fail',
                tenantId: 'tenant-1',
                userId: 'user-1',
                templateId: 'agent-1',
            },
            requestId: 'req-policy-fail',
        })).rejects.toThrow('policy store unavailable');
    });

    test('并发达到上限时使用并发配额原因写入事实', async () => {
        const policyRecords: Array<Record<string, unknown>> = [];
        const service = new RunAdmissionService({
            cost: {
                async checkTenantQuotaGate() {
                    return {
                        allowed: false,
                        reason: 'CONCURRENT_SESSION_LIMIT',
                        quota: {maxTokensPerDay: 100, maxConcurrentSessions: 1},
                        usage: {totalTokensToday: 1, runningSessions: 1},
                    };
                },
            },
            policyDecision: {
                async record(input) {
                    policyRecords.push(input);
                    return input as never;
                },
            },
            auditEvent: {
                async record(input) {
                    return input as never;
                },
            },
        });

        await expect(service.enforceThreadDispatch({
            thread: {
                id: 'thread-concurrent',
                tenantId: 'tenant-1',
                userId: 'user-1',
                templateId: 'agent-1',
            },
            requestId: 'req-concurrent',
        })).rejects.toThrow(ApiError);

        expect(policyRecords[0]).toMatchObject({
            reason: '租户并发运行数已达到上限',
            details: {
                reason: 'CONCURRENT_SESSION_LIMIT',
                quota: {maxTokensPerDay: 100, maxConcurrentSessions: 1},
                usage: {totalTokensToday: 1, runningSessions: 1},
            },
        });
    });
});
