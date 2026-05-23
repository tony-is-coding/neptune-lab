import type {FastifyReply} from 'fastify';
import type {ApiErrorEnvelope} from '@shared/neptune-ai';

export class ApiError extends Error {
    readonly envelope: Required<ApiErrorEnvelope>;
    readonly statusCode: number;

    constructor(statusCode: number, envelope: ApiErrorEnvelope) {
        const normalized = createApiErrorEnvelope(envelope);
        super(normalized.message);
        this.name = 'ApiError';
        this.statusCode = statusCode;
        this.envelope = normalized;
    }

    toString(): string {
        return this.envelope.message;
    }
}

export function createApiErrorEnvelope(envelope: ApiErrorEnvelope): Required<ApiErrorEnvelope> {
    return {
        error: envelope.error,
        message: envelope.message,
        requestId: envelope.requestId ?? '',
        details: envelope.details ?? {},
    };
}

export function toApiErrorEnvelope(
    error: unknown,
    fallback: ApiErrorEnvelope,
): Required<ApiErrorEnvelope> {
    if (error instanceof ApiError) {
        return error.envelope;
    }

    if (error && typeof error === 'object') {
        const candidate = error as Partial<ApiErrorEnvelope> & {code?: unknown};
        const code = typeof candidate.error === 'string'
            ? candidate.error
            : typeof candidate.code === 'string'
                ? candidate.code
                : fallback.error;
        const message = typeof candidate.message === 'string' ? candidate.message : fallback.message;
        const requestId = typeof candidate.requestId === 'string' ? candidate.requestId : fallback.requestId;
        const details = candidate.details && typeof candidate.details === 'object'
            ? candidate.details as Record<string, unknown>
            : fallback.details;

        return createApiErrorEnvelope({error: code, message, requestId, details});
    }

    if (typeof error === 'string' && error) {
        return createApiErrorEnvelope({...fallback, message: error});
    }

    return createApiErrorEnvelope(fallback);
}

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
