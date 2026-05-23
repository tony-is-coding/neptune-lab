import type {FastifyInstance} from 'fastify';
import {runService} from '../services/run';
import {runFactService} from '../services/run-facts';
import {auditEventService} from '../services/audit';
import {agentVersionService} from '../services/agent-version';
import {policyDecisionService} from '../services/policy-decision';
import {artifactEvidenceService} from '../services/artifact-evidence';
import {platformCostService} from '../services/platform-cost';
import {humanReviewService} from '../services/human-review';
import {runObservabilityService} from '../services/run-observability';
import {sendApiError, replyApiError, replyUnknownError} from '../utils/api-error';
import {createLogger} from '../utils/logger';
import type {
    CostSummaryPeriod,
    CreateHumanReviewRequest,
    DecideHumanReviewRequest,
    HumanReviewStatus,
} from '@shared/neptune-ai';

const log = createLogger('routes:platform-facts');

function parsePage(query: {limit?: string; offset?: string}) {
    const parsedLimit = Number.parseInt(query.limit ?? '50', 10);
    const parsedOffset = Number.parseInt(query.offset ?? '0', 10);

    return {
        limit: Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 200) : 50,
        offset: Number.isFinite(parsedOffset) ? Math.max(parsedOffset, 0) : 0,
    };
}

/**
 * AgentOps 平台事实查询路由
 *
 * 这些 API 是 Delivery / Governance / Business Workspace 的事实来源。
 * 它们只暴露 neptune-ai 产品层事实，不泄漏 neptune-engine 内部执行细节。
 */
export async function platformFactRoutes(fastify: FastifyInstance) {
    fastify.get<{
        Querystring: {
            agentId?: string;
            threadId?: string;
            status?: string;
            limit?: string;
            offset?: string;
        };
    }>('/runs', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        const user = request.user!;
        const page = parsePage(request.query);

        try {
            return await runService.listByTenant(user.tenantId, {
                agentId: request.query.agentId,
                threadId: request.query.threadId,
                status: request.query.status,
                ...page,
            });
        } catch (error) {
            log.error('List runs failed', {requestId: request.requestId, detail: (error as Error).message});
            return sendApiError(reply, 500, {
                error: 'INTERNAL_ERROR',
                message: '获取运行记录列表失败',
                requestId: request.requestId,
            });
        }
    });

    fastify.get<{
        Params: {runId: string};
        Querystring: {
            limit?: string;
            offset?: string;
        };
    }>('/runs/:runId/events', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        const user = request.user!;
        const page = parsePage(request.query);

        try {
            return await runFactService.listEventsByRun(user.tenantId, request.params.runId, page);
        } catch (error) {
            if ((error as Error).message === 'RUN_NOT_FOUND') {
                return sendApiError(reply, 404, {
                    error: 'RESOURCE_NOT_FOUND',
                    message: '未找到对应运行记录，或你没有权限访问。',
                    requestId: request.requestId,
                });
            }
            log.error('List run events failed', {requestId: request.requestId, detail: (error as Error).message});
            return sendApiError(reply, 500, {
                error: 'INTERNAL_ERROR',
                message: '获取运行事件失败',
                requestId: request.requestId,
            });
        }
    });

    fastify.get<{
        Params: {runId: string};
        Querystring: {
            limit?: string;
            offset?: string;
        };
    }>('/runs/:runId/tool-invocations', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        const user = request.user!;
        const page = parsePage(request.query);

        try {
            return await runFactService.listToolInvocationsByRun(user.tenantId, request.params.runId, page);
        } catch (error) {
            if ((error as Error).message === 'RUN_NOT_FOUND') {
                return sendApiError(reply, 404, {
                    error: 'RESOURCE_NOT_FOUND',
                    message: '未找到对应运行记录，或你没有权限访问。',
                    requestId: request.requestId,
                });
            }
            log.error('List tool invocations failed', {requestId: request.requestId, detail: (error as Error).message});
            return sendApiError(reply, 500, {
                error: 'INTERNAL_ERROR',
                message: '获取工具调用失败',
                requestId: request.requestId,
            });
        }
    });

    fastify.get<{
        Params: {runId: string};
        Querystring: {
            artifactType?: string;
            sourceType?: string;
            limit?: string;
            offset?: string;
        };
    }>('/runs/:runId/artifacts', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        const user = request.user!;
        const page = parsePage(request.query);

        try {
            return await artifactEvidenceService.listArtifactsByRun(user.tenantId, request.params.runId, {
                artifactType: request.query.artifactType,
                sourceType: request.query.sourceType,
                ...page,
            });
        } catch (error) {
            if ((error as Error).message === 'RUN_NOT_FOUND') {
                return sendApiError(reply, 404, {
                    error: 'RESOURCE_NOT_FOUND',
                    message: '未找到对应运行记录，或你没有权限访问。',
                    requestId: request.requestId,
                });
            }
            log.error('List artifacts failed', {requestId: request.requestId, detail: (error as Error).message});
            return sendApiError(reply, 500, {
                error: 'INTERNAL_ERROR',
                message: '获取成果文件失败',
                requestId: request.requestId,
            });
        }
    });

    fastify.get<{
        Params: {runId: string};
        Querystring: {
            evidenceType?: string;
            limit?: string;
            offset?: string;
        };
    }>('/runs/:runId/evidence-artifacts', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        const user = request.user!;
        const page = parsePage(request.query);

        try {
            return await artifactEvidenceService.listEvidenceArtifactsByRun(user.tenantId, request.params.runId, {
                evidenceType: request.query.evidenceType,
                ...page,
            });
        } catch (error) {
            if ((error as Error).message === 'RUN_NOT_FOUND') {
                return sendApiError(reply, 404, {
                    error: 'RESOURCE_NOT_FOUND',
                    message: '未找到对应运行记录，或你没有权限访问。',
                    requestId: request.requestId,
                });
            }
            log.error('List evidence artifacts failed', {requestId: request.requestId, detail: (error as Error).message});
            return sendApiError(reply, 500, {
                error: 'INTERNAL_ERROR',
                message: '获取证据元数据失败',
                requestId: request.requestId,
            });
        }
    });

    fastify.get<{
        Params: {runId: string};
    }>('/runs/:runId/observability', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        const user = request.user!;

        try {
            const observability = await runObservabilityService.getByRun(user.tenantId, request.params.runId);
            if (!observability) {
                return sendApiError(reply, 404, {
                    error: 'RESOURCE_NOT_FOUND',
                    message: '未找到对应运行记录，或你没有权限访问。',
                    requestId: request.requestId,
                });
            }
            return observability;
        } catch (error) {
            log.error('Get run observability failed', {requestId: request.requestId, detail: (error as Error).message});
            return sendApiError(reply, 500, {
                error: 'INTERNAL_ERROR',
                message: '获取运行观测关联失败',
                requestId: request.requestId,
            });
        }
    });

    fastify.get<{
        Querystring: {
            period?: CostSummaryPeriod;
        };
    }>('/cost-summary', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        const user = request.user!;
        const period = normalizeCostPeriod(request.query.period);

        try {
            return await platformCostService.getCostSummary(user.tenantId, period);
        } catch (error) {
            log.error('Get cost summary failed', {requestId: request.requestId, detail: (error as Error).message});
            return sendApiError(reply, 500, {
                error: 'INTERNAL_ERROR',
                message: '获取成本概览失败',
                requestId: request.requestId,
            });
        }
    });

    fastify.get('/quota/status', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        const user = request.user!;

        try {
            return await platformCostService.getQuotaStatus(user.tenantId);
        } catch (error) {
            log.error('Get quota status failed', {requestId: request.requestId, detail: (error as Error).message});
            return sendApiError(reply, 500, {
                error: 'INTERNAL_ERROR',
                message: '获取配额状态失败',
                requestId: request.requestId,
            });
        }
    });

    fastify.get<{
        Querystring: {
            action?: string;
            resourceType?: string;
            resourceId?: string;
            outcome?: string;
            limit?: string;
            offset?: string;
        };
    }>('/audit-events', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        const user = request.user!;
        const page = parsePage(request.query);

        try {
            return await auditEventService.listByTenant(user.tenantId, {
                action: request.query.action,
                resourceType: request.query.resourceType,
                resourceId: request.query.resourceId,
                outcome: request.query.outcome,
                ...page,
            });
        } catch (error) {
            log.error('List audit events failed', {requestId: request.requestId, detail: (error as Error).message});
            return sendApiError(reply, 500, {
                error: 'INTERNAL_ERROR',
                message: '获取审计事件失败',
                requestId: request.requestId,
            });
        }
    });

    fastify.get<{
        Querystring: {
            action?: string;
            resourceType?: string;
            resourceId?: string;
            outcome?: string;
        };
    }>('/audit-events/export', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        const user = request.user!;

        try {
            const exported = await auditEventService.exportCsvByTenant(user.tenantId, {
                action: request.query.action,
                resourceType: request.query.resourceType,
                resourceId: request.query.resourceId,
                outcome: request.query.outcome,
            });
            await auditEventService.record({
                tenantId: user.tenantId,
                userId: user.userId,
                requestId: request.requestId,
                action: 'audit_events.exported',
                resourceType: 'audit_events',
                resourceId: 'audit_events',
                outcome: 'success',
                metadata: {
                    filters: {
                        action: request.query.action ?? null,
                        resourceType: request.query.resourceType ?? null,
                        resourceId: request.query.resourceId ?? null,
                        outcome: request.query.outcome ?? null,
                    },
                    exportedCount: exported.exportedCount,
                },
            });

            return reply
                .header('Content-Type', 'text/csv; charset=utf-8')
                .header('Content-Disposition', `attachment; filename="${exported.filename}"`)
                .send(exported.content);
        } catch (error) {
            log.error('Export audit events failed', {requestId: request.requestId, detail: (error as Error).message});
            return sendApiError(reply, 500, {
                error: 'INTERNAL_ERROR',
                message: '导出审计事件失败',
                requestId: request.requestId,
            });
        }
    });

    fastify.get<{
        Querystring: {
            runId?: string;
            status?: HumanReviewStatus;
            reviewType?: string;
            assignedTo?: string;
            limit?: string;
            offset?: string;
        };
    }>('/human-reviews', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        const user = request.user!;
        const page = parsePage(request.query);

        try {
            return await humanReviewService.listByTenant(user.tenantId, {
                runId: request.query.runId,
                status: normalizeHumanReviewStatus(request.query.status),
                reviewType: request.query.reviewType,
                assignedTo: request.query.assignedTo,
                ...page,
            });
        } catch (error) {
            log.error('List human reviews failed', {requestId: request.requestId, detail: (error as Error).message});
            return sendApiError(reply, 500, {
                error: 'INTERNAL_ERROR',
                message: '获取复核队列失败',
                requestId: request.requestId,
            });
        }
    });

    fastify.post<{
        Body: CreateHumanReviewRequest;
    }>('/human-reviews', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        const user = request.user!;

        try {
            const review = await humanReviewService.create({
                tenantId: user.tenantId,
                userId: user.userId,
                input: request.body,
            });
            return reply.status(201).send(review);
        } catch (error) {
            const message = (error as Error).message;
            if (message === 'RUN_NOT_FOUND') {
                return sendApiError(reply, 404, {
                    error: 'RESOURCE_NOT_FOUND',
                    message: '未找到对应运行记录，或你没有权限访问。',
                    requestId: request.requestId,
                });
            }
            if (message.endsWith('_REQUIRED')) {
                return sendApiError(reply, 400, {
                    error: 'VALIDATION_FAILED',
                    message: '提交复核失败：复核对象、标题和原因不能为空。',
                    requestId: request.requestId,
                });
            }
            log.error('Create human review failed', {requestId: request.requestId, detail: message});
            return sendApiError(reply, 500, {
                error: 'INTERNAL_ERROR',
                message: '提交复核失败',
                requestId: request.requestId,
            });
        }
    });

    fastify.post<{
        Params: {reviewId: string};
        Body: DecideHumanReviewRequest;
    }>('/human-reviews/:reviewId/decision', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        const user = request.user!;

        try {
            return await humanReviewService.decide({
                tenantId: user.tenantId,
                userId: user.userId,
                reviewId: request.params.reviewId,
                input: request.body,
            });
        } catch (error) {
            const message = (error as Error).message;
            if (message === 'REVIEW_NOT_FOUND') {
                return sendApiError(reply, 404, {
                    error: 'RESOURCE_NOT_FOUND',
                    message: '未找到对应复核项，或你没有权限访问。',
                    requestId: request.requestId,
                });
            }
            if (message === 'REVIEW_ALREADY_DECIDED') {
                return sendApiError(reply, 409, {
                    error: 'STATE_CONFLICT',
                    message: '该复核项已经处理，不能重复决策。',
                    requestId: request.requestId,
                });
            }
            if (message === 'INVALID_DECISION' || message === 'REASON_REQUIRED') {
                return sendApiError(reply, 400, {
                    error: 'VALIDATION_FAILED',
                    message: '提交复核决策失败：决策类型和原因不能为空。',
                    requestId: request.requestId,
                });
            }
            log.error('Decide human review failed', {requestId: request.requestId, detail: message});
            return sendApiError(reply, 500, {
                error: 'INTERNAL_ERROR',
                message: '提交复核决策失败',
                requestId: request.requestId,
            });
        }
    });

    fastify.get<{
        Querystring: {
            runId?: string;
            decision?: string;
            policyType?: string;
            subjectType?: string;
            limit?: string;
            offset?: string;
        };
    }>('/policy-decisions', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        const user = request.user!;
        const page = parsePage(request.query);

        try {
            return await policyDecisionService.listByTenant(user.tenantId, {
                runId: request.query.runId,
                decision: request.query.decision,
                policyType: request.query.policyType,
                subjectType: request.query.subjectType,
                ...page,
            });
        } catch (error) {
            log.error('List policy decisions failed', {requestId: request.requestId, detail: (error as Error).message});
            return sendApiError(reply, 500, {
                error: 'INTERNAL_ERROR',
                message: '获取策略决策失败',
                requestId: request.requestId,
            });
        }
    });

    fastify.get<{
        Params: {agentId: string};
        Querystring: {
            limit?: string;
            offset?: string;
        };
    }>('/agents/:agentId/versions', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        const user = request.user!;
        const page = parsePage(request.query);

        try {
            return await agentVersionService.listForAgent({
                tenantId: user.tenantId,
                agentId: request.params.agentId,
                ...page,
            });
        } catch (error) {
            log.error('List agent versions failed', {requestId: request.requestId, detail: (error as Error).message});
            return sendApiError(reply, 500, {
                error: 'INTERNAL_ERROR',
                message: '获取智能体版本列表失败',
                requestId: request.requestId,
            });
        }
    });
}

function normalizeCostPeriod(period: CostSummaryPeriod | undefined): CostSummaryPeriod {
    if (period === 'today' || period === 'month_to_date' || period === 'all_time') return period;
    return 'today';
}

function normalizeHumanReviewStatus(status: HumanReviewStatus | undefined): HumanReviewStatus | undefined {
    if (status === 'pending' || status === 'approved' || status === 'rejected' || status === 'waived') {
        return status;
    }
    return undefined;
}
