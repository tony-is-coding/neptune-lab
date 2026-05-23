import type {FastifyInstance} from 'fastify';
import {closingWorkbenchService} from '../services/closing-workbench';
import {ApiError, sendApiError, replyApiError, replyUnknownError} from '../utils/api-error';
import {API_ERROR_STATUS, type ApiErrorEnvelope} from '@shared/neptune-ai';
import {createLogger} from '../utils/logger';
import type {
    CreateCloseWorkspaceRequest,
    DecideCloseReviewRequest,
    GenerateCloseChecksRequest,
    GenerateCloseReportRequest,
    ImportCloseCsvEvidenceRequest,
    SubmitFindingReviewRequest,
} from '@shared/neptune-ai';

const log = createLogger('routes:closing');
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseMultipartBoundary(contentType: string | undefined) {
    const match = contentType?.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    return match?.[1] ?? match?.[2] ?? null;
}

function parseMultipartFormData(body: unknown, contentType: string | undefined): Record<string, {value: string; filename?: string}> {
    const boundary = parseMultipartBoundary(contentType);
    if (!boundary || !Buffer.isBuffer(body)) return {};

    const raw = body.toString('utf8');
    const fields: Record<string, {value: string; filename?: string}> = {};
    const parts = raw.split(`--${boundary}`);

    for (const part of parts) {
        const trimmed = part.replace(/^\r?\n/, '').replace(/\r?\n$/, '');
        if (!trimmed || trimmed === '--') continue;

        const separatorIndex = trimmed.indexOf('\r\n\r\n');
        if (separatorIndex < 0) continue;

        const rawHeaders = trimmed.slice(0, separatorIndex);
        const value = trimmed.slice(separatorIndex + 4).replace(/\r\n--$/, '');
        const disposition = rawHeaders.split(/\r\n/).find(header => header.toLowerCase().startsWith('content-disposition:'));
        const name = disposition?.match(/name="([^"]+)"/)?.[1];
        if (!name) continue;

        const filename = disposition?.match(/filename="([^"]*)"/)?.[1];
        fields[name] = {value, filename};
    }

    return fields;
}

function csvImportInputFromRequest(body: unknown, contentType: string | undefined): ImportCloseCsvEvidenceRequest {
    if (contentType?.includes('multipart/form-data')) {
        const fields = parseMultipartFormData(body, contentType);
        return {
            periodId: fields.periodId?.value ?? '',
            fileName: fields.file?.filename ?? '',
            content: fields.file?.value ?? '',
            sourceSystem: fields.sourceSystem?.value || undefined,
            ledgerName: fields.ledgerName?.value || undefined,
            accountSet: fields.accountSet?.value || undefined,
            findingId: fields.findingId?.value || undefined,
        };
    }

    return body as ImportCloseCsvEvidenceRequest;
}

function parsePage(query: {limit?: string; offset?: string}, defaults: {limit?: number} = {}) {
    const defaultLimit = defaults.limit ?? 50;
    const parsedLimit = Number.parseInt(query.limit ?? String(defaultLimit), 10);
    const parsedOffset = Number.parseInt(query.offset ?? '0', 10);

    return {
        limit: Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 200) : defaultLimit,
        offset: Number.isFinite(parsedOffset) ? Math.max(parsedOffset, 0) : 0,
    };
}

function sendRouteError(reply: Parameters<typeof sendApiError>[0], error: unknown, fallback: ApiErrorEnvelope) {
    if (error instanceof ApiError) {
        return sendApiError(reply, error.statusCode, error.envelope);
    }

    return sendApiError(reply, API_ERROR_STATUS[fallback.error], fallback);
}

export async function closingRoutes(fastify: FastifyInstance) {
    fastify.addContentTypeParser(/^multipart\/form-data(?:;.*)?$/i, {parseAs: 'buffer'}, (_request, body, done) => {
        done(null, body);
    });

    fastify.get<{
        Querystring: {limit?: string; offset?: string};
    }>('/workspaces', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        const user = request.user!;
        try {
            return await closingWorkbenchService.listWorkspaces(user.tenantId, parsePage(request.query));
        } catch (error) {
            log.error('List close workspaces failed', {requestId: request.requestId, detail: (error as Error).message});
            return sendApiError(reply, 500, {
                error: 'INTERNAL_ERROR',
                message: '获取关账工作区失败',
                requestId: request.requestId,
            });
        }
    });

    fastify.post<{
        Body: CreateCloseWorkspaceRequest;
    }>('/workspaces', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        const user = request.user!;
        try {
            const created = await closingWorkbenchService.createWorkspace({
                tenantId: user.tenantId,
                userId: user.userId,
                requestId: request.requestId,
                input: request.body,
            });
            return reply.status(201).send(created);
        } catch (error) {
            const message = (error as Error).message;
            if (message.endsWith('_REQUIRED')) {
                return sendApiError(reply, 400, {
                    error: 'VALIDATION_FAILED',
                    message: '创建关账工作区失败：名称和会计期间不能为空。',
                    requestId: request.requestId,
                });
            }
            log.error('Create close workspace failed', {requestId: request.requestId, detail: message});
            return sendApiError(reply, 500, {
                error: 'INTERNAL_ERROR',
                message: '创建关账工作区失败',
                requestId: request.requestId,
            });
        }
    });

    fastify.get<{
        Params: {workspaceId: string};
    }>('/workspaces/:workspaceId', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        const user = request.user!;
        try {
            return await closingWorkbenchService.getWorkspace(user.tenantId, request.params.workspaceId);
        } catch (error) {
            if ((error as Error).message.endsWith('_NOT_FOUND')) return notFound(reply, request.requestId);
            log.error('Get close workspace failed', {requestId: request.requestId, detail: (error as Error).message});
            return sendApiError(reply, 500, {
                error: 'INTERNAL_ERROR',
                message: '获取关账工作区失败',
                requestId: request.requestId,
            });
        }
    });

    fastify.get<{
        Params: {workspaceId: string};
    }>('/workspaces/:workspaceId/overview', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        const user = request.user!;
        try {
            return await closingWorkbenchService.getOverview(user.tenantId, request.params.workspaceId);
        } catch (error) {
            if ((error as Error).message.endsWith('_NOT_FOUND')) return notFound(reply, request.requestId);
            log.error('Get close overview failed', {requestId: request.requestId, detail: (error as Error).message});
            return sendApiError(reply, 500, {
                error: 'INTERNAL_ERROR',
                message: '获取关账概览失败',
                requestId: request.requestId,
            });
        }
    });

    fastify.get<{
        Params: {workspaceId: string};
    }>('/workspaces/:workspaceId/checklist', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        const user = request.user!;
        try {
            return await closingWorkbenchService.listChecklist(user.tenantId, request.params.workspaceId);
        } catch (error) {
            if ((error as Error).message.endsWith('_NOT_FOUND')) return notFound(reply, request.requestId);
            log.error('List close checklist failed', {requestId: request.requestId, detail: (error as Error).message});
            return sendApiError(reply, 500, {
                error: 'INTERNAL_ERROR',
                message: '获取关账检查清单失败',
                requestId: request.requestId,
            });
        }
    });

    fastify.get<{
        Params: {workspaceId: string};
    }>('/workspaces/:workspaceId/findings', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        const user = request.user!;
        try {
            return await closingWorkbenchService.listFindings(user.tenantId, request.params.workspaceId);
        } catch (error) {
            if ((error as Error).message.endsWith('_NOT_FOUND')) return notFound(reply, request.requestId);
            log.error('List close findings failed', {requestId: request.requestId, detail: (error as Error).message});
            return sendApiError(reply, 500, {
                error: 'INTERNAL_ERROR',
                message: '获取关账异常失败',
                requestId: request.requestId,
            });
        }
    });

    fastify.get<{
        Params: {workspaceId: string};
        Querystring: {limit?: string; offset?: string};
    }>('/workspaces/:workspaceId/evidence-artifacts', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        const user = request.user!;
        try {
            return await closingWorkbenchService.listEvidenceArtifacts(
                user.tenantId,
                request.params.workspaceId,
                parsePage(request.query),
            );
        } catch (error) {
            if ((error as Error).message.endsWith('_NOT_FOUND')) return notFound(reply, request.requestId);
            log.error('List close evidence artifacts failed', {requestId: request.requestId, detail: (error as Error).message});
            return sendApiError(reply, 500, {
                error: 'INTERNAL_ERROR',
                message: '获取关账证据失败',
                requestId: request.requestId,
            });
        }
    });

    fastify.get<{
        Params: {workspaceId: string};
        Querystring: {limit?: string; offset?: string};
    }>('/workspaces/:workspaceId/workflow-timeline', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        const user = request.user!;
        try {
            return await closingWorkbenchService.listWorkflowTimeline(
                user.tenantId,
                request.params.workspaceId,
                parsePage(request.query, {limit: 100}),
            );
        } catch (error) {
            if ((error as Error).message.endsWith('_NOT_FOUND')) return notFound(reply, request.requestId);
            log.error('List close workflow timeline failed', {requestId: request.requestId, detail: (error as Error).message});
            return sendApiError(reply, 500, {
                error: 'INTERNAL_ERROR',
                message: '获取关账工作流时间线失败',
                requestId: request.requestId,
            });
        }
    });

    fastify.get<{
        Params: {workspaceId: string};
    }>('/workspaces/:workspaceId/report-snapshots', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        const user = request.user!;
        try {
            return await closingWorkbenchService.listReports(user.tenantId, request.params.workspaceId);
        } catch (error) {
            if ((error as Error).message.endsWith('_NOT_FOUND')) return notFound(reply, request.requestId);
            log.error('List close reports failed', {requestId: request.requestId, detail: (error as Error).message});
            return sendApiError(reply, 500, {
                error: 'INTERNAL_ERROR',
                message: '获取关账报告失败',
                requestId: request.requestId,
            });
        }
    });

    fastify.post<{
        Params: {workspaceId: string};
        Body: GenerateCloseChecksRequest;
    }>('/workspaces/:workspaceId/checks:generate', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        const user = request.user!;
        try {
            return await closingWorkbenchService.generateChecks({
                tenantId: user.tenantId,
                userId: user.userId,
                requestId: request.requestId,
                workspaceId: request.params.workspaceId,
                input: request.body,
            });
        } catch (error) {
            if ((error as Error).message.endsWith('_NOT_FOUND')) return notFound(reply, request.requestId);
            log.error('Generate close checks failed', {requestId: request.requestId, detail: (error as Error).message});
            return sendRouteError(reply, error, {
                error: 'INTERNAL_ERROR',
                message: '发起关账检查失败',
                requestId: request.requestId,
            });
        }
    });

    fastify.post<{
        Params: {workspaceId: string};
        Body: ImportCloseCsvEvidenceRequest | Buffer;
    }>('/workspaces/:workspaceId/evidence-imports:csv', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        const user = request.user!;
        try {
            const contentType = Array.isArray(request.headers['content-type'])
                ? request.headers['content-type'][0]
                : request.headers['content-type'];
            const result = await closingWorkbenchService.importCsvEvidence({
                tenantId: user.tenantId,
                userId: user.userId,
                requestId: request.requestId,
                workspaceId: request.params.workspaceId,
                input: csvImportInputFromRequest(request.body, contentType),
            });
            return reply.status(201).send(result);
        } catch (error) {
            const message = (error as Error).message;
            if (message.endsWith('_NOT_FOUND')) return notFound(reply, request.requestId);
            if (message === 'CSV_IMPORT_INVALID') {
                return sendApiError(reply, 400, {
                    error: 'VALIDATION_FAILED',
                    message: 'CSV 证据导入失败：期间、文件名和 CSV 内容不能为空，且文件必须为 .csv。',
                    requestId: request.requestId,
                });
            }
            log.error('Import close CSV evidence failed', {requestId: request.requestId, detail: message});
            return sendApiError(reply, 500, {
                error: 'INTERNAL_ERROR',
                message: '导入 CSV 证据失败',
                requestId: request.requestId,
            });
        }
    });

    fastify.post<{
        Params: {findingId: string};
        Body: SubmitFindingReviewRequest;
    }>('/findings/:findingId/submit-review', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        const user = request.user!;
        try {
            const result = await closingWorkbenchService.submitFindingReview({
                tenantId: user.tenantId,
                userId: user.userId,
                requestId: request.requestId,
                findingId: request.params.findingId,
                reason: request.body.reason,
            });
            return reply.status(201).send(result);
        } catch (error) {
            if ((error as Error).message.endsWith('_NOT_FOUND')) return notFound(reply, request.requestId);
            log.error('Submit close finding review failed', {requestId: request.requestId, detail: (error as Error).message});
            return sendApiError(reply, 500, {
                error: 'INTERNAL_ERROR',
                message: '提交关账复核失败',
                requestId: request.requestId,
            });
        }
    });

    fastify.post<{
        Params: {reviewId: string; decision: string};
        Body: DecideCloseReviewRequest;
    }>('/reviews/:reviewId/:decision', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        const user = request.user!;
        const decision = normalizeDecision(request.params.decision);
        if (!decision) {
            return sendApiError(reply, 400, {
                error: 'VALIDATION_FAILED',
                message: '复核决策只能是 approve、reject 或 waive。',
                requestId: request.requestId,
            });
        }
        try {
            return await closingWorkbenchService.decideReview({
                tenantId: user.tenantId,
                userId: user.userId,
                requestId: request.requestId,
                reviewId: request.params.reviewId,
                decision,
                reason: request.body.reason,
            });
        } catch (error) {
            const message = (error as Error).message;
            if (message.endsWith('_NOT_FOUND')) return notFound(reply, request.requestId);
            if (message === 'REVIEW_ALREADY_DECIDED') {
                return sendApiError(reply, 409, {
                    error: 'STATE_CONFLICT',
                    message: '该复核项已经处理，不能重复决策。',
                    requestId: request.requestId,
                });
            }
            log.error('Decide close review failed', {requestId: request.requestId, detail: message});
            return sendApiError(reply, 500, {
                error: 'INTERNAL_ERROR',
                message: '处理关账复核失败',
                requestId: request.requestId,
            });
        }
    });

    fastify.post<{
        Params: {workspaceId: string};
        Body: GenerateCloseReportRequest;
    }>('/workspaces/:workspaceId/report-snapshots', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        const user = request.user!;
        try {
            const report = await closingWorkbenchService.generateReport({
                tenantId: user.tenantId,
                userId: user.userId,
                requestId: request.requestId,
                workspaceId: request.params.workspaceId,
                input: request.body,
            });
            return reply.status(201).send(report);
        } catch (error) {
            const message = (error as Error).message;
            if (message.endsWith('_NOT_FOUND')) return notFound(reply, request.requestId);
            if (message.startsWith('CLOSE_REPORT_NOT_READY:')) {
                return sendApiError(reply, 409, {
                    error: 'STATE_CONFLICT',
                    message: message.slice('CLOSE_REPORT_NOT_READY:'.length),
                    requestId: request.requestId,
                });
            }
            log.error('Generate close report failed', {requestId: request.requestId, detail: message});
            return sendApiError(reply, 500, {
                error: 'INTERNAL_ERROR',
                message: '生成关账报告失败',
                requestId: request.requestId,
            });
        }
    });

    fastify.get<{
        Params: {reportId: string};
    }>('/report-snapshots/:reportId', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        const user = request.user!;
        if (!uuidPattern.test(request.params.reportId)) {
            return notFound(reply, request.requestId);
        }

        try {
            return await closingWorkbenchService.getReportDetail(user.tenantId, request.params.reportId);
        } catch (error) {
            if ((error as Error).message.endsWith('_NOT_FOUND')) return notFound(reply, request.requestId);
            log.error('Get close report failed', {requestId: request.requestId, detail: (error as Error).message});
            return sendApiError(reply, 500, {
                error: 'INTERNAL_ERROR',
                message: '获取关账报告失败',
                requestId: request.requestId,
            });
        }
    });
}

function normalizeDecision(value: string): 'approve' | 'reject' | 'waive' | null {
    if (value === 'approve' || value === 'reject' || value === 'waive') return value;
    return null;
}

function notFound(reply: Parameters<typeof sendApiError>[0], requestId?: string) {
    return sendApiError(reply, 404, {
        error: 'RESOURCE_NOT_FOUND',
        message: '未找到对应关账资源，或你没有权限访问。',
        requestId,
    });
}
