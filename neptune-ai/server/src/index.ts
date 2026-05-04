import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config';
import { db } from './db';
import { authRoutes } from './routes/auth';
import { tenantRoutes } from './routes/tenants';
import { userRoutes } from './routes/users';
import { agentRoutes } from './routes/agents';
import { sessionRoutes } from './routes/sessions';
import { threadRoutes } from './routes/threads';
import { billingRoutes } from './routes/billing';
import { authMiddleware } from './middleware/auth';


/**
 * 创建 Fastify 应用
 */
async function createApp() {
  const app = Fastify({
    logger: {
      level: config.log.level,
    },
  });

  // 注册 CORS 插件
  await app.register(cors, {
    origin: true, // 生产环境应该配置具体的 origin
    credentials: true,
  });

  // 注册认证装饰器
  app.decorate('authenticate', authMiddleware);

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
    await app.register(authRoutes, { prefix: '/auth' });

    // 租户路由
    await app.register(tenantRoutes, { prefix: '/tenants' });

    // 用户路由
    await app.register(userRoutes, { prefix: '/users' });

    // Agent 模板路由
    await app.register(agentRoutes, { prefix: '/agents' });

    // Thread CRUD + Chat 路由（必须在 sessionRoutes 之前注册，避免路径冲突）
    await app.register(threadRoutes, { prefix: '/agents' });

    // Agent Chat 路由（旧接口兼容）
    await app.register(sessionRoutes, { prefix: '/agents' });

    // 计费路由
    await app.register(billingRoutes, { prefix: '/tenants' });
  }, { prefix: '/api/v1' });

  return app;
}

/**
 * 启动服务器
 */
async function start() {
  const app = await createApp();

  try {
    await app.listen({
      port: config.server.port,
      host: config.server.host,
    });

    console.log(`🚀 Neptune-AI 服务器启动成功`);
    console.log(`📍 地址: http://${config.server.host}:${config.server.port}`);
    console.log(`🏥 健康检查: http://${config.server.host}:${config.server.port}/health`);
  } catch (error) {
    console.error('❌ 服务器启动失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此文件，则启动服务器
if (import.meta.main) {
  start();
}

export { createApp };
