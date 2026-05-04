import type { FastifyInstance } from 'fastify';
import { agentTemplateService } from '../services/agent-template';
import { roleMiddleware } from '../middleware/auth';
import { db, documents } from '../db';
import { eq, and } from 'drizzle-orm';
import { mkdir, writeFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

/**
 * Agent 模板管理路由
 */
export async function agentRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/agents
   * 创建 Agent 模板
   */
  fastify.post('/', {
    preHandler: [fastify.authenticate, roleMiddleware('admin')],
  }, async (request, reply) => {
    const {
      name,
      description,
      systemPrompt,
      modelConfig,
      tools,
      skills,
      mcpServers,
      constraints,
    } = request.body as {
      name: string;
      description?: string;
      systemPrompt: string;
      modelConfig: {
        provider: string;
        model: string;
        temperature: number;
        maxTokens: number;
      };
      tools?: string[];
      skills?: Array<{ id: string; name: string; version?: string }>;
      mcpServers?: Array<{ name: string; url: string; authConfig?: Record<string, unknown> }>;
      constraints?: {
        maxTokensPerTurn: number;
        maxTurnsPerSession: number;
        maxConcurrentSessions: number;
      };
    };

    const tenantId = request.user!.tenantId;

    if (!name || !systemPrompt || !modelConfig) {
      return reply.status(400).send({
        error: 'BAD_REQUEST',
        message: '缺少必填字段',
      });
    }

    try {
      const template = await agentTemplateService.create({
        tenantId,
        name,
        description,
        systemPrompt,
        modelConfig,
        tools: tools || [],
        skills: skills || [],
        mcpServers: mcpServers || [],
        constraints: constraints || {
          maxTokensPerTurn: 10000,
          maxTurnsPerSession: 100,
          maxConcurrentSessions: 10,
        },
      });

      reply.status(201).send(template);
    } catch (error) {
      request.log.error(error);
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: '创建 Agent 模板失败',
      });
    }
  });

  /**
   * GET /api/agents/:id
   * 获取 Agent 模板详情
   */
  fastify.get('/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const template = await agentTemplateService.findById(id);

      if (!template) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'Agent 模板不存在',
        });
      }

      reply.send(template);
    } catch (error) {
      request.log.error(error);
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: '获取 Agent 模板失败',
      });
    }
  });

  /**
   * GET /api/agents
   * 获取 Agent 模板列表
   */
  fastify.get('/', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { active, limit, offset } = request.query as {
      active?: string;
      limit?: string;
      offset?: string;
    };

    const tenantId = request.user!.tenantId;

    try {
      const templates = await agentTemplateService.findByTenantId(
        tenantId,
        active === 'true',
        limit ? parseInt(limit, 10) : 100,
        offset ? parseInt(offset, 10) : 0,
      );

      reply.send({
        data: templates,
        meta: {
          count: templates.length,
          limit: limit ? parseInt(limit, 10) : 100,
          offset: offset ? parseInt(offset, 10) : 0,
        },
      });
    } catch (error) {
      request.log.error(error);
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: '获取 Agent 模板列表失败',
      });
    }
  });

  /**
   * PUT /api/agents/:id
   * 更新 Agent 模板
   */
  fastify.put('/:id', {
    preHandler: [fastify.authenticate, roleMiddleware('admin')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const {
      name,
      description,
      systemPrompt,
      modelConfig,
      tools,
      skills,
      mcpServers,
      constraints,
      isActive,
    } = request.body as {
      name?: string;
      description?: string;
      systemPrompt?: string;
      modelConfig?: {
        provider: string;
        model: string;
        temperature: number;
        maxTokens: number;
      };
      tools?: string[];
      skills?: Array<{ id: string; name: string; version?: string }>;
      mcpServers?: Array<{ name: string; url: string; authConfig?: Record<string, unknown> }>;
      constraints?: {
        maxTokensPerTurn: number;
        maxTurnsPerSession: number;
        maxConcurrentSessions: number;
      };
      isActive?: boolean;
    };

    try {
      const template = await agentTemplateService.update(id, {
        name,
        description,
        systemPrompt,
        modelConfig,
        tools,
        skills,
        mcpServers,
        constraints,
        isActive,
      });

      if (!template) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'Agent 模板不存在',
        });
      }

      reply.send(template);
    } catch (error) {
      request.log.error(error);
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: '更新 Agent 模板失败',
      });
    }
  });

  /**
   * PATCH /api/agents/:id/activate
   * 激活 Agent 模板
   */
  fastify.patch('/:id/activate', {
    preHandler: [fastify.authenticate, roleMiddleware('admin')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const template = await agentTemplateService.setActive(id, true);

      if (!template) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'Agent 模板不存在',
        });
      }

      reply.send(template);
    } catch (error) {
      request.log.error(error);
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: '激活 Agent 模板失败',
      });
    }
  });

  /**
   * PATCH /api/agents/:id/deactivate
   * 停用 Agent 模板
   */
  fastify.patch('/:id/deactivate', {
    preHandler: [fastify.authenticate, roleMiddleware('admin')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const template = await agentTemplateService.setActive(id, false);

      if (!template) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'Agent 模板不存在',
        });
      }

      reply.send(template);
    } catch (error) {
      request.log.error(error);
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: '停用 Agent 模板失败',
      });
    }
  });

  /**
   * DELETE /api/agents/:id
   * 删除 Agent 模板
   */
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate, roleMiddleware('admin')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const success = await agentTemplateService.delete(id);

      if (!success) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'Agent 模板不存在',
        });
      }

      reply.status(204).send();
    } catch (error) {
      request.log.error(error);
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: '删除 Agent 模板失败',
      });
    }
  });

  // ===== BE-1: Agent Stats Endpoint =====

  /**
   * GET /api/agents/:id/stats
   * 获取 Agent 统计数据
   */
  fastify.get('/:id/stats', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const stats = await agentTemplateService.getStats(id);

      if (!stats) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'Agent 模板不存在',
        });
      }

      reply.send(stats);
    } catch (error) {
      request.log.error(error);
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: '获取统计数据失败',
      });
    }
  });

  // ===== BE-2: Document Management Endpoints =====

  /**
   * GET /api/agents/:id/documents
   * 获取 Agent 文档列表
   */
  fastify.get('/:id/documents', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const docs = await db.select().from(documents).where(eq(documents.templateId, id));
      reply.send({ data: docs });
    } catch (error) {
      request.log.error(error);
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: '获取文档列表失败',
      });
    }
  });

  /**
   * POST /api/agents/:id/documents
   * 上传文档到 Agent
   */
  fastify.post('/:id/documents', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = request.user!.tenantId;

    try {
      const data = request.body as {
        name: string;
        type: string;
        size: number;
        content: string; // base64 encoded
      };

      if (!data.name || !data.type) {
        return reply.status(400).send({
          error: 'BAD_REQUEST',
          message: '缺少文件名或类型',
        });
      }

      // Store file
      const storageDir = path.join(process.cwd(), 'data', 'tenants', tenantId, 'agents', id, 'documents');
      if (!existsSync(storageDir)) {
        await mkdir(storageDir, { recursive: true });
      }

      const filePath = path.join(storageDir, data.name);
      const buffer = Buffer.from(data.content, 'base64');
      await writeFile(filePath, buffer);

      // Save to DB
      const [doc] = await db.insert(documents).values({
        templateId: id,
        tenantId,
        name: data.name,
        type: data.type,
        size: data.size || buffer.length,
        path: filePath,
      }).returning();

      reply.status(201).send(doc);
    } catch (error) {
      request.log.error(error);
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: '上传文档失败',
      });
    }
  });

  /**
   * DELETE /api/agents/:id/documents/:docId
   * 删除 Agent 文档
   */
  fastify.delete('/:id/documents/:docId', {
    preHandler: [fastify.authenticate, roleMiddleware('admin')],
  }, async (request, reply) => {
    const { id, docId } = request.params as { id: string; docId: string };

    try {
      const [doc] = await db.select().from(documents).where(
        and(eq(documents.id, docId), eq(documents.templateId, id))
      ).limit(1);

      if (!doc) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: '文档不存在',
        });
      }

      // Delete file from disk
      if (existsSync(doc.path)) {
        await unlink(doc.path);
      }

      // Delete from DB
      await db.delete(documents).where(eq(documents.id, docId));

      reply.status(204).send();
    } catch (error) {
      request.log.error(error);
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: '删除文档失败',
      });
    }
  });
}
