import type {JwtPayload} from '../services/auth';

declare module 'fastify' {
    interface FastifyInstance {
        authenticate: (
            request: FastifyRequest,
            reply: FastifyReply,
            done: (err?: Error) => void,
        ) => void | Promise<void>;
    }

    interface FastifyRequest {
        user?: JwtPayload;
        tenantId?: string;
        requestId?: string;
    }
}
