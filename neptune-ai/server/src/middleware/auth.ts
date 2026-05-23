import type {FastifyRequest, FastifyReply, HookHandlerDoneFunction} from 'fastify';
import {authService, type JwtPayload} from '../services/auth';
import {sendApiError} from '../utils/api-error';

function sendAndStop(
    reply: FastifyReply,
    statusCode: number,
    envelope: Parameters<typeof sendApiError>[2],
): void {
    sendApiError(reply, statusCode, envelope);
}

/**
 * 扩展 Fastify Request 类型，添加用户信息和租户上下文
 */
declare module 'fastify' {
    interface FastifyRequest {
        user?: JwtPayload;
        tenantId?: string;
        requestId?: string;
    }
}

/**
 * 认证中间件
 * 验证 JWT 令牌并将用户信息附加到请求对象
 */
export function authMiddleware(
    request: FastifyRequest,
    reply: FastifyReply,
    done: HookHandlerDoneFunction,
): void {
    try {
        // 从 Authorization 头获取令牌
        const authHeader = request.headers.authorization;

        if (!authHeader) {
            sendAndStop(reply, 401, {
                error: 'UNAUTHORIZED',
                message: '缺少认证令牌',
                requestId: request.requestId,
            });
            return;
        }

        // 提取 Bearer 令牌
        const [, token] = authHeader.split(' ');

        if (!token) {
            sendAndStop(reply, 401, {
                error: 'UNAUTHORIZED',
                message: '无效的认证令牌格式',
                requestId: request.requestId,
            });
            return;
        }

        // 验证令牌
        authService.verifyAccessToken(token)
            .then((payload) => {
                // 将用户信息附加到请求对象
                request.user = payload;

                // 注入租户上下文
                request.tenantId = payload.tenantId;
                done();
            })
            .catch(() => {
                sendAndStop(reply, 401, {
                    error: 'UNAUTHORIZED',
                    message: '认证令牌无效或已过期',
                    requestId: request.requestId,
                });
            });
    } catch (error) {
        sendAndStop(reply, 401, {
            error: 'UNAUTHORIZED',
            message: '认证令牌无效或已过期',
            requestId: request.requestId,
        });
        return;
    }
}

/**
 * 可选认证中间件
 * 如果提供了令牌则验证，否则继续处理请求
 */
export async function optionalAuthMiddleware(
    request: FastifyRequest,
    reply: FastifyReply,
): Promise<void> {
    try {
        const authHeader = request.headers.authorization;

        if (!authHeader) {
            // 没有提供令牌，继续处理请求
            return;
        }

        const [, token] = authHeader.split(' ');

        if (!token) {
            return;
        }

        // 验证令牌并附加用户信息
        const payload = await authService.verifyAccessToken(token);
        request.user = payload;

        // 注入租户上下文
        request.tenantId = payload.tenantId;
    } catch (error) {
        // 令牌无效，但不阻止请求
        // 可以选择记录日志
    }
}

/**
 * 角色检查中间件工厂
 * 检查用户是否具有指定角色
 * @param allowedRoles 允许的角色列表
 */
export function roleMiddleware(...allowedRoles: string[]) {
    return (request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction): void => {
        const user = request.user;

        if (!user) {
            sendAndStop(reply, 401, {
                error: 'UNAUTHORIZED',
                message: '需要认证',
                requestId: request.requestId,
            });
            return;
        }

        if (!allowedRoles.includes(user.role)) {
            sendAndStop(reply, 403, {
                error: 'FORBIDDEN',
                message: '权限不足',
                requestId: request.requestId,
            });
            return;
        }

        done();
    };
}

/**
 * 租户上下文注入中间件
 * 从已认证的用户信息中提取租户 ID 并注入到请求上下文
 * 必须在认证中间件之后使用
 */
export async function tenantContextMiddleware(
    request: FastifyRequest,
    reply: FastifyReply,
): Promise<void | FastifyReply> {
    // 检查用户是否已认证
    if (!request.user) {
        return sendApiError(reply, 401, {
            error: 'UNAUTHORIZED',
            message: '需要认证',
            requestId: request.requestId,
        });
    }

    // 注入租户上下文
    request.tenantId = request.user.tenantId;
}
