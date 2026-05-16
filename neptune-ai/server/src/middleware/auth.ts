import type {FastifyRequest, FastifyReply} from 'fastify';
import {authService, type JwtPayload} from '../services/auth';

/**
 * 扩展 Fastify Request 类型，添加用户信息和租户上下文
 */
declare module 'fastify' {
    interface FastifyRequest {
        user?: JwtPayload;
        tenantId?: string;
    }
}

/**
 * 认证中间件
 * 验证 JWT 令牌并将用户信息附加到请求对象
 */
export async function authMiddleware(
    request: FastifyRequest,
    reply: FastifyReply,
): Promise<void> {
    try {
        // 从 Authorization 头获取令牌
        const authHeader = request.headers.authorization;

        if (!authHeader) {
            return reply.code(401).send({
                error: 'UNAUTHORIZED',
                message: '缺少认证令牌',
            });
        }

        // 提取 Bearer 令牌
        const [, token] = authHeader.split(' ');

        if (!token) {
            return reply.code(401).send({
                error: 'UNAUTHORIZED',
                message: '无效的认证令牌格式',
            });
        }

        // 验证令牌
        const payload = await authService.verifyAccessToken(token);

        // 将用户信息附加到请求对象
        request.user = payload;

        // 注入租户上下文
        request.tenantId = payload.tenantId;
    } catch (error) {
        return reply.code(401).send({
            error: 'UNAUTHORIZED',
            message: '认证令牌无效或已过期',
        });
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
    return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        const user = request.user;

        if (!user) {
            return reply.code(401).send({
                error: 'UNAUTHORIZED',
                message: '需要认证',
            });
        }

        if (!allowedRoles.includes(user.role)) {
            return reply.code(403).send({
                error: 'FORBIDDEN',
                message: '权限不足',
            });
        }
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
): Promise<void> {
    // 检查用户是否已认证
    if (!request.user) {
        reply.code(401).send({
            error: 'UNAUTHORIZED',
            message: '需要认证',
        });
        return;
    }

    // 注入租户上下文
    request.tenantId = request.user.tenantId;
}
