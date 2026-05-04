import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { userService } from '../services/user';
import { roleMiddleware } from '../middleware/auth';

/**
 * 用户管理路由
 */
export async function userRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/users
   * 创建用户
   */
  fastify.post('/', {
    preHandler: [fastify.authenticate, roleMiddleware('admin')],
  }, async (request, reply) => {
    const { name, email, password, role } = request.body as {
      name: string;
      email: string;
      password: string;
      role?: string;
    };

    const tenantId = request.user!.tenantId;

    if (!name || !email || !password) {
      return reply.status(400).send({
        error: 'BAD_REQUEST',
        message: '缺少必填字段',
      });
    }

    try {
      // 检查邮箱是否已被使用
      const existingUser = await userService.findByEmail(email);
      if (existingUser) {
        return reply.status(400).send({
          error: 'BAD_REQUEST',
          message: '邮箱已被使用',
        });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await userService.create({
        tenantId,
        name,
        email,
        passwordHash,
        role: role || 'user',
      });

      reply.status(201).send(user);
    } catch (error) {
      request.log.error(error);
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: '创建用户失败',
      });
    }
  });

  /**
   * GET /api/users/:id
   * 获取用户详情
   */
  fastify.get('/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const user = await userService.findById(id);

      if (!user) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: '用户不存在',
        });
      }

      // 不返回密码哈希
      const { passwordHash, ...userWithoutPassword } = user;
      reply.send(userWithoutPassword);
    } catch (error) {
      request.log.error(error);
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: '获取用户失败',
      });
    }
  });

  /**
   * GET /api/users
   * 获取用户列表
   */
  fastify.get('/', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { limit, offset } = request.query as {
      limit?: string;
      offset?: string;
    };

    const tenantId = request.user!.tenantId;

    try {
      const users = await userService.findByTenantId(
        tenantId,
        limit ? parseInt(limit, 10) : 100,
        offset ? parseInt(offset, 10) : 0,
      );

      // 不返回密码哈希
      const usersWithoutPassword = users.map(({ passwordHash, ...user }) => user);

      reply.send({
        data: usersWithoutPassword,
        meta: {
          count: usersWithoutPassword.length,
          limit: limit ? parseInt(limit, 10) : 100,
          offset: offset ? parseInt(offset, 10) : 0,
        },
      });
    } catch (error) {
      request.log.error(error);
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: '获取用户列表失败',
      });
    }
  });

  /**
   * PUT /api/users/:id
   * 更新用户
   */
  fastify.put('/:id', {
    preHandler: [fastify.authenticate, roleMiddleware('admin')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { name, email, password, role } = request.body as {
      name?: string;
      email?: string;
      password?: string;
      role?: string;
    };

    try {
      // 如果更新邮箱，检查是否已被使用
      if (email) {
        const existingUser = await userService.isEmailTaken(email, id);
        if (existingUser) {
          return reply.status(400).send({
            error: 'BAD_REQUEST',
            message: '邮箱已被使用',
          });
        }
      }

      const updateData: Record<string, unknown> = { name, email, role };
      if (password) {
        updateData.passwordHash = await bcrypt.hash(password, 10);
      }

      const user = await userService.update(id, updateData as Parameters<typeof userService.update>[1]);

      if (!user) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: '用户不存在',
        });
      }

      // 不返回密码哈希
      const { passwordHash: _, ...userWithoutPassword } = user;
      reply.send(userWithoutPassword);
    } catch (error) {
      request.log.error(error);
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: '更新用户失败',
      });
    }
  });

  /**
   * DELETE /api/users/:id
   * 删除用户
   */
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate, roleMiddleware('admin')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const success = await userService.delete(id);

      if (!success) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: '用户不存在',
        });
      }

      reply.status(204).send();
    } catch (error) {
      request.log.error(error);
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: '删除用户失败',
      });
    }
  });
}
