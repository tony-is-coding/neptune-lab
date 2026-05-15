import type { FastifyInstance } from 'fastify';
import { authService } from '../services/auth';
import { db, users, tenants } from '../db';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { createLogger } from '../utils/logger';

const log = createLogger('routes:auth');

/**
 * 认证相关路由
 */
export async function authRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/auth/login
   * 用户登录
   */
  fastify.post('/login', async (request, reply) => {
    const loginSchema = {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string' },
      },
    };

    // 简单验证
    const { email, password } = request.body as { email: string; password: string };

    if (!email || !password) {
      reply.status(400).send({
        error: 'BAD_REQUEST',
        message: '邮箱和密码不能为空',
      });
      return;
    }

    try {
      // 查找用户
      const user = await db.query.users.findFirst({
        where: eq(users.email, email),
      });

      if (!user) {
        reply.status(401).send({
          error: 'UNAUTHORIZED',
          message: '邮箱或密码错误',
        });
        return;
      }

      // 使用 bcrypt 验证密码
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

      if (!isPasswordValid) {
        reply.status(401).send({
          error: 'UNAUTHORIZED',
          message: '邮箱或密码错误',
        });
        return;
      }

      // 生成令牌
      const tokens = await authService.signTokenPair({
        userId: user.id,
        tenantId: user.tenantId,
        email: user.email,
        role: user.role,
      });

      reply.send({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId,
        },
        ...tokens,
      });
    } catch (error) {
      log.error('Request failed', { detail: (error as Error).message });
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: '登录失败',
      });
    }
  });

  /**
   * POST /api/v1/auth/register
   * 用户注册
   *
   * 支持两种模式：
   * 1. 提供 tenantId → 加入已有租户（角色为 user）
   * 2. 提供 tenantName → 创建新租户 + 首个管理员（角色为 admin）
   */
  fastify.post('/register', async (request, reply) => {
    const { tenantId, tenantName, name, email, password } = request.body as {
      tenantId?: string;
      tenantName?: string;
      name: string;
      email: string;
      password: string;
    };

    if (!name || !email || !password) {
      reply.status(400).send({
        error: 'BAD_REQUEST',
        message: 'name, email, password 为必填字段',
      });
      return;
    }

    if (!tenantId && !tenantName) {
      reply.status(400).send({
        error: 'BAD_REQUEST',
        message: '必须提供 tenantId（加入已有租户）或 tenantName（创建新租户）',
      });
      return;
    }

    try {
      let resolvedTenantId = tenantId;
      let role = 'user';

      // 模式2：创建新租户
      if (tenantName && !tenantId) {
        const [newTenant] = await db
          .insert(tenants)
          .values({ name: tenantName })
          .returning();
        resolvedTenantId = newTenant.id;
        role = 'admin'; // 创建租户的用户自动成为管理员
      } else {
        // 模式1：验证租户是否存在
        const tenant = await db.query.tenants.findFirst({
          where: eq(tenants.id, tenantId!),
        });

        if (!tenant) {
          reply.status(400).send({
            error: 'BAD_REQUEST',
            message: '租户不存在',
          });
          return;
        }
      }

      // 检查邮箱是否已注册
      const existingUser = await db.query.users.findFirst({
        where: eq(users.email, email),
      });

      if (existingUser) {
        reply.status(400).send({
          error: 'BAD_REQUEST',
          message: '邮箱已被注册',
        });
        return;
      }

      // 使用 bcrypt 哈希密码
      const passwordHash = await bcrypt.hash(password, 10);

      // 创建用户
      const [newUser] = await db
        .insert(users)
        .values({
          tenantId: resolvedTenantId!,
          name,
          email,
          passwordHash,
          role,
        })
        .returning();

      // 生成令牌
      const tokens = await authService.signTokenPair({
        userId: newUser.id,
        tenantId: newUser.tenantId,
        email: newUser.email,
        role: newUser.role,
      });

      reply.status(201).send({
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          tenantId: newUser.tenantId,
        },
        ...tokens,
      });
    } catch (error) {
      log.error('Request failed', { detail: (error as Error).message });
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: '注册失败',
      });
    }
  });

  /**
   * POST /api/auth/token/refresh
   * 刷新访问令牌
   */
  fastify.post('/token/refresh', async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken: string };

    if (!refreshToken) {
      reply.status(400).send({
        error: 'BAD_REQUEST',
        message: '刷新令牌不能为空',
      });
      return;
    }

    try {
      const tokens = await authService.refreshTokens(refreshToken);

      reply.send(tokens);
    } catch (error) {
      reply.status(401).send({
        error: 'UNAUTHORIZED',
        message: '刷新令牌无效或已过期',
      });
    }
  });

  /**
   * GET /api/auth/me
   * 获取当前用户信息
   */
  fastify.get('/me', {
    onRequest: [async (request, reply) => {
      // 这里应该使用认证中间件
      const authHeader = request.headers.authorization;
      if (!authHeader) {
        return reply.status(401).send({ error: 'UNAUTHORIZED', message: '需要认证' });
      }
      const [, token] = authHeader.split(' ');
      if (!token) {
        return reply.status(401).send({ error: 'UNAUTHORIZED', message: '无效的令牌格式' });
      }
      try {
        const { authService } = await import('../services/auth');
        const payload = await authService.verifyAccessToken(token);
        (request as any).user = payload;
      } catch (error) {
        return reply.status(401).send({ error: 'UNAUTHORIZED', message: '令牌无效' });
      }
    }],
  }, async (request, reply) => {
    const user = (request as any).user;

    // 再次检查用户是否存在（防止中间件未正确阻止）
    if (!user) {
      return reply.status(401).send({
        error: 'UNAUTHORIZED',
        message: '需要认证',
      });
    }

    try {
      // 从数据库获取完整用户信息
      const userInfo = await db.query.users.findFirst({
        where: eq(users.id, user.userId),
      });

      if (!userInfo) {
        reply.status(404).send({
          error: 'NOT_FOUND',
          message: '用户不存在',
        });
        return;
      }

      reply.send({
        id: userInfo.id,
        name: userInfo.name,
        email: userInfo.email,
        role: userInfo.role,
        tenantId: userInfo.tenantId,
      });
    } catch (error) {
      log.error('Request failed', { detail: (error as Error).message });
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: '获取用户信息失败',
      });
    }
  });
}
