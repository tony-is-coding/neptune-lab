// ===== 平台级环境变量（必须在所有 import 之前设置） =====
// 禁用 SDK 读取任何 CLAUDE.md 文件 — Neptune 是独立 SaaS 平台，不依赖本地项目
process.env.CLAUDE_CODE_DISABLE_CLAUDE_MDS = '1';
// 禁用 SDK 注入 git status 到 system prompt — Neptune Agent 不是 coding agent
process.env.CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS = 'true';
// 覆盖 SDK 内部使用的 Anthropic 环境变量 — 强制走 Neptune 配置的 LLM Provider
// SDK 的 callModel (queryModelWithStreaming) 直接读取这些 env vars
if (process.env.NEPTUNE_LLM_API_KEY) {
    process.env.ANTHROPIC_API_KEY = process.env.NEPTUNE_LLM_API_KEY;
}
if (process.env.NEPTUNE_LLM_BASE_URL) {
    process.env.ANTHROPIC_BASE_URL = process.env.NEPTUNE_LLM_BASE_URL;
}

import Fastify from 'fastify';
import cors from '@fastify/cors';
import bcrypt from 'bcrypt';
import {randomUUID} from 'crypto';
import {eq} from 'drizzle-orm';
import {config} from './config';
import {db} from './db';
import {users, tenants} from './db/schema';
import {authRoutes} from './routes/auth';
import {tenantRoutes} from './routes/tenants';
import {userRoutes} from './routes/users';
import {agentRoutes} from './routes/agents';
import {threadRoutes} from './routes/threads';
import {billingRoutes} from './routes/billing';
import {skillRoutes} from './routes/skills';
import {projectRoutes} from './routes/projects';
import {runRoutes} from './routes/runs';
import {platformFactRoutes} from './routes/platform-facts';
import {closingRoutes} from './routes/closing';
import {authMiddleware} from './middleware/auth';
import {initLogger, createLogger} from './utils/logger';
import {sendApiError, toApiErrorEnvelope} from './utils/api-error';
import {initObservability, shutdownObservability} from './services/observability';

// 初始化全局日志
initLogger(config.log.level as any);

// 初始化可观测性（Langfuse）
initObservability();

const log = createLogger('server');


/**
 * 创建 Fastify 应用
 */
async function createApp() {
    const app = Fastify({
        logger: false, // 禁用 Fastify 内置 pino，统一使用 LogUtil
    });

    // HTTP 请求/响应日志 hook
    app.addHook('onRequest', (request, reply, done) => {
        (request as any)._startTime = performance.now();
        const requestIdHeader = request.headers['x-request-id'];
        const requestId = Array.isArray(requestIdHeader)
            ? requestIdHeader[0]
            : requestIdHeader;
        request.requestId = requestId || randomUUID();
        reply.header('X-Request-Id', request.requestId);
        done();
    });

    app.addHook('onResponse', (request, reply, done) => {
        const durationMs = Math.round(performance.now() - ((request as any)._startTime || 0));
        const statusCode = reply.statusCode;
        const level = statusCode >= 400 ? 'warn' : 'info';
        log[level](`${request.method} ${request.url} ${statusCode}`, {
            requestId: request.requestId,
            tenantId: request.user?.tenantId,
            userId: request.user?.userId,
            durationMs,
            remoteAddress: request.ip,
        });
        done();
    });

    // 注册 CORS 插件
    await app.register(cors, {
        origin: true, // 生产环境应该配置具体的 origin
        credentials: true,
    });

    // 注册认证装饰器
    app.decorate('authenticate', authMiddleware);

    // 全局未捕获错误兜底：保证任何 throw / Fastify schema 校验失败 / 路由抛出
    // 都会以标准错误信封 + requestId 返回，并写入审计可追溯的日志。
    app.setErrorHandler((error: unknown, request, reply) => {
        const fastifyValidationError = (error as {validation?: unknown}).validation;
        if (fastifyValidationError) {
            log.warn('Fastify schema 校验失败', {
                requestId: request.requestId,
                url: request.url,
                method: request.method,
                detail: error instanceof Error ? error.message : String(error),
            });
            return sendApiError(reply, 400, {
                error: 'VALIDATION_FAILED',
                message: 'Schema 校验失败：' + (error instanceof Error ? error.message : String(error)),
                requestId: request.requestId,
                details: {validation: fastifyValidationError},
            });
        }

        log.error('未捕获的路由异常', {
            requestId: request.requestId,
            url: request.url,
            method: request.method,
            detail: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });

        const {statusCode, envelope} = toApiErrorEnvelope(error, {
            error: 'INTERNAL_ERROR',
            message: '服务器内部错误',
            requestId: request.requestId,
        });
        return sendApiError(reply, statusCode, envelope);
    });

    // 全局 404 兜底：路由未匹配也走标准错误信封。
    app.setNotFoundHandler((request, reply) => {
        return sendApiError(reply, 404, {
            error: 'RESOURCE_NOT_FOUND',
            message: `路由不存在：${request.method} ${request.url}`,
            requestId: request.requestId,
        });
    });

    // 健康检查端点
    app.get('/health', async () => {
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
        };
    });

    // 数据库健康检查
    app.get('/health/db', async () => {
        try {
            await db.execute('SELECT 1');
            return {
                status: 'ok',
                database: 'connected',
            };
        } catch (error) {
            return {
                status: 'error',
                database: 'disconnected',
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });

    // API 路由组
    app.register(async function (app) {
        // 认证路由
        await app.register(authRoutes, {prefix: '/auth'});

        // 租户路由
        await app.register(tenantRoutes, {prefix: '/tenants'});

        // 用户路由
        await app.register(userRoutes, {prefix: '/users'});

        // Agent 模板路由
        await app.register(agentRoutes, {prefix: '/agents'});

        // Thread CRUD + Chat 路由
        await app.register(threadRoutes, {prefix: '/agents'});

        // 计费路由
        await app.register(billingRoutes, {prefix: '/tenants'});

        // Skills 路由
        await app.register(skillRoutes, {prefix: '/skills'});

        // CustomerProject 路由
        await app.register(projectRoutes, {prefix: '/projects'});

        // RunControl 正式运行控制路由
        await app.register(runRoutes);

        // AgentOps 平台事实查询路由（旧路径兼容：/runs、/audit-events、/agents/:id/versions）
        await app.register(platformFactRoutes);

        // AgentOps 平台事实查询路由（产品路径：/platform-facts/...）
        await app.register(platformFactRoutes, {prefix: '/platform-facts'});

        // 中国 ERP 财务月结关账 Solution Pack
        await app.register(closingRoutes, {prefix: '/closing'});
    }, {prefix: '/api/v1'});

    return app;
}

/**
 * 确保默认管理员用户存在
 *
 * 邮箱: admin  密码: admin  角色: admin
 * 如果 admin 邮箱已存在则跳过。
 */
async function ensureDefaultAdmin() {
    try {
        const existing = await db.query.users.findFirst({
            where: eq(users.email, 'admin'),
        });

        if (existing) return;

        // 创建默认租户
        const [tenant] = await db.insert(tenants).values({name: 'Default'}).returning();

        // 创建管理员用户
        const passwordHash = await bcrypt.hash('admin', 10);
        await db.insert(users).values({
            tenantId: tenant.id,
            name: 'Admin',
            email: 'admin@neptune.ai',
            passwordHash,
            role: 'admin',
        });

        log.info('Default admin created — email: admin@neptune.ai');
    } catch (error) {
        log.debug('Default admin creation skipped', {reason: (error as Error).message});
    }
}

/**
 * 启动服务器
 */
async function start() {
    const app = await createApp();

    try {
        // 启动前确保默认管理员存在
        await ensureDefaultAdmin();

        await app.listen({
            port: config.server.port,
            host: config.server.host,
        });

        log.info('Neptune-AI server started', {
            host: config.server.host,
            port: config.server.port,
        });
    } catch (error) {
        log.error('Server start failed', {detail: (error as Error).message});
        process.exit(1);
    }
}

// 如果直接运行此文件，则启动服务器
if (import.meta.main) {
    start();

    // 优雅关闭
    process.on('SIGTERM', async () => {
        await shutdownObservability();
        process.exit(0);
    });
    process.on('SIGINT', async () => {
        await shutdownObservability();
        process.exit(0);
    });
}

export {createApp};
