import type {FastifyReply, FastifyRequest} from 'fastify';
import type {ApiErrorCode, ApiErrorEnvelope} from '@shared/neptune-ai';
import {API_ERROR_STATUS, isApiErrorCode} from '@shared/neptune-ai';

/**
 * 标准化错误异常。
 *
 * 用法：
 *   throw new ApiError('STATE_CONFLICT', '关账期间已锁定', {
 *       reason: 'workspace_locked',
 *   });
 *
 * - status 默认按 API_ERROR_STATUS 映射；如需特殊场景显式覆盖请传入 statusCode
 * - 不要继续手写 reply.status(...).send({error,...})，所有错误响应必须经过
 *   sendApiError / replyApiError / 全局 setErrorHandler
 */
export class ApiError extends Error {
    readonly envelope: Required<ApiErrorEnvelope>;
    readonly statusCode: number;

    constructor(
        code: ApiErrorCode,
        message: string,
        details?: Record<string, unknown>,
        options?: {statusCode?: number; requestId?: string},
    ) {
        const normalized = createApiErrorEnvelope({
            error: code,
            message,
            requestId: options?.requestId,
            details,
        });
        super(normalized.message);
        this.name = 'ApiError';
        this.statusCode = options?.statusCode ?? API_ERROR_STATUS[code];
        this.envelope = normalized;
    }

    toString(): string {
        return this.envelope.message;
    }
}

/**
 * 生成完整结构的错误信封。requestId/details 缺失时填充默认值，保证类型一致性。
 */
export function createApiErrorEnvelope(envelope: ApiErrorEnvelope): Required<ApiErrorEnvelope> {
    return {
        error: envelope.error,
        message: envelope.message,
        requestId: envelope.requestId ?? '',
        details: envelope.details ?? {},
    };
}

/**
 * 将任意异常对象规范化为标准信封。
 * 主要给全局 setErrorHandler 使用，把不规则 throw 收口。
 */
export function toApiErrorEnvelope(
    error: unknown,
    fallback: ApiErrorEnvelope,
): {statusCode: number; envelope: Required<ApiErrorEnvelope>} {
    if (error instanceof ApiError) {
        return {statusCode: error.statusCode, envelope: error.envelope};
    }

    if (error && typeof error === 'object') {
        const candidate = error as Partial<ApiErrorEnvelope> & {code?: unknown; statusCode?: unknown};
        const errorRaw = typeof candidate.error === 'string'
            ? candidate.error
            : typeof candidate.code === 'string'
                ? candidate.code
                : fallback.error;
        const code: ApiErrorCode = isApiErrorCode(errorRaw) ? errorRaw : fallback.error;
        const message = typeof candidate.message === 'string' ? candidate.message : fallback.message;
        const requestId = typeof candidate.requestId === 'string' ? candidate.requestId : fallback.requestId;
        const details = candidate.details && typeof candidate.details === 'object'
            ? candidate.details as Record<string, unknown>
            : fallback.details;
        const statusCode = typeof candidate.statusCode === 'number'
            ? candidate.statusCode
            : API_ERROR_STATUS[code];

        return {
            statusCode,
            envelope: createApiErrorEnvelope({error: code, message, requestId, details}),
        };
    }

    if (typeof error === 'string' && error) {
        return {
            statusCode: API_ERROR_STATUS[fallback.error],
            envelope: createApiErrorEnvelope({...fallback, message: error}),
        };
    }

    return {
        statusCode: API_ERROR_STATUS[fallback.error],
        envelope: createApiErrorEnvelope(fallback),
    };
}

/**
 * 旧调用风格：手动 statusCode + envelope。保留以减小迁移面，新代码推荐使用 replyApiError。
 */
export function sendApiError(
    reply: FastifyReply,
    statusCode: number,
    envelope: ApiErrorEnvelope,
) {
    const normalized = createApiErrorEnvelope(envelope);
    if (normalized.requestId) {
        reply.header('X-Request-Id', normalized.requestId);
    }
    return reply.status(statusCode).send(normalized);
}

/**
 * 推荐的路由级错误响应入口。
 *
 * - 自动从 request 注入 requestId
 * - statusCode 默认按错误码映射
 * - 强类型 ApiErrorCode，IDE 立即提示合法值
 *
 * 用法：
 *   return replyApiError(request, reply, 'VALIDATION_FAILED', '邮箱不能为空');
 *   return replyApiError(request, reply, 'STATE_CONFLICT', '复核已结束', {
 *       details: {reason: 'review_already_decided'},
 *   });
 */
export function replyApiError(
    request: FastifyRequest,
    reply: FastifyReply,
    code: ApiErrorCode,
    message: string,
    options?: {
        details?: Record<string, unknown>;
        statusCode?: number;
    },
) {
    return sendApiError(reply, options?.statusCode ?? API_ERROR_STATUS[code], {
        error: code,
        message,
        requestId: request.requestId,
        details: options?.details,
    });
}

/**
 * 将任何异常规范化后落到响应。
 * 路由 catch 块内推荐写：
 *   } catch (error) {
 *       return replyUnknownError(request, reply, error, '获取智能体失败');
 *   }
 */
export function replyUnknownError(
    request: FastifyRequest,
    reply: FastifyReply,
    error: unknown,
    fallbackMessage: string,
    fallbackCode: ApiErrorCode = 'INTERNAL_ERROR',
) {
    const {statusCode, envelope} = toApiErrorEnvelope(error, {
        error: fallbackCode,
        message: fallbackMessage,
        requestId: request.requestId,
    });
    return sendApiError(reply, statusCode, envelope);
}
