import type {FastifyReply} from 'fastify';
import type {ApiErrorEnvelope} from '@shared/neptune-ai';

export function sendApiError(
    reply: FastifyReply,
    statusCode: number,
    envelope: ApiErrorEnvelope,
) {
    if (envelope.requestId) {
        reply.header('X-Request-Id', envelope.requestId);
    }
    return reply.status(statusCode).send(envelope);
}
