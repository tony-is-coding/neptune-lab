import type {FastifyInstance} from 'fastify';
import {agentTemplateService} from '../services/agent-template';
import {roleMiddleware} from '../middleware/auth';
import {db, documents} from '../db';
import {eq, and} from 'drizzle-orm';
import {mkdir, writeFile, unlink} from 'fs/promises';
import {existsSync} from 'fs';
import path from 'path';
import {createLogger} from '../utils/logger';

const log = createLogger('routes:agents');

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
            log.error('Request failed', {detail: (error as Error).message});
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
        const {id} = request.params as { id: string };

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
            log.error('Request failed', {detail: (error as Error).message});
            reply.status(500).send({
                error: 'INTERNAL_ERROR',
                message: '获取 Agent 模板失败',
            });
        }
    });

    /**
     * GET /api/agents
     * 获取 Agent 模板列表
     * 支持查询参数：
     * - active: boolean - 只返回激活的 Agent
     * - limit: number - 限制返回数量
     * - offset: number - 偏移量
     * - include: string - 包含额外信息，支持 'thread_summary'
     */
    fastify.get('/', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        const {active, limit, offset, include} = request.query as {
            active?: string;
            limit?: string;
            offset?: string;
            include?: string;
        };

        const tenantId = request.user!.tenantId;
        const userId = request.user!.userId;

        try {
            const includeThreadSummary = include === 'thread_summary';

            const templates = includeThreadSummary
                ? await agentTemplateService.listWithThreadSummary(
                    tenantId,
                    {
                        userId,
                        activeOnly: active === 'true',
                        limit: limit ? parseInt(limit, 10) : 100,
                        offset: offset ? parseInt(offset, 10) : 0,
                    },
                )
                : await agentTemplateService.findByTenantId(
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
                    include: includeThreadSummary ? 'thread_summary' : undefined,
                },
            });
        } catch (error) {
            log.error('Request failed', {detail: (error as Error).message});
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
        const {id} = request.params as { id: string };
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
            log.error('Request failed', {detail: (error as Error).message});
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
        const {id} = request.params as { id: string };

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
            log.error('Request failed', {detail: (error as Error).message});
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
        const {id} = request.params as { id: string };

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
            log.error('Request failed', {detail: (error as Error).message});
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
        const {id} = request.params as { id: string };

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
            log.error('Request failed', {detail: (error as Error).message});
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
        const {id} = request.params as { id: string };

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
            log.error('Request failed', {detail: (error as Error).message});
            reply.status(500).send({
                error: 'INTERNAL_ERROR',
                message: '获取统计数据失败',
            });
        }
    });

    // ===== BE-2: Document Management Endpoints =====

    /**
     * 文件存储根路径
     * 优先使用 DATA_ROOT 环境变量，默认 ./data
     */
    const dataRoot = process.env.DATA_ROOT || './data';

    /**
     * GET /api/agents/:id/documents
     * 获取 Agent 文档列表
     * 支持查询参数 category 过滤
     */
    fastify.get('/:id/documents', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        const {id} = request.params as { id: string };
        const {category} = request.query as { category?: string };

        try {
            const conditions = [eq(documents.templateId, id)];
            if (category) {
                conditions.push(eq(documents.category, category));
            }

            const docs = await db.select().from(documents).where(
                conditions.length === 1 ? conditions[0] : and(...conditions),
            );
            reply.send({data: docs});
        } catch (error) {
            log.error('Request failed', {detail: (error as Error).message});
            reply.status(500).send({
                error: 'INTERNAL_ERROR',
                message: '获取文档列表失败',
            });
        }
    });

    /**
     * POST /api/agents/:id/documents
     * 上传文档到 Agent
     *
     * 同时支持两种上传方式：
     * 1. multipart/form-data — 前端 FormData 方式（file 字段 + 可选 category 字段）
     * 2. application/json — base64 编码方式（兼容旧前端）
     */
    fastify.post('/:id/documents', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        const {id} = request.params as { id: string };
        const tenantId = request.user!.tenantId;
        const contentType = request.headers['content-type'] || '';

        try {
            let fileName: string;
            let fileType: string;
            let fileSize: number;
            let fileBuffer: Buffer;
            let category: string = 'document';

            if (contentType.includes('multipart/form-data')) {
                // ===== multipart/form-data 方式 =====
                const formData = await request.formData();
                const file = formData.get('file');

                if (!file || !(file instanceof File)) {
                    return reply.status(400).send({
                        error: 'BAD_REQUEST',
                        message: '缺少 file 字段',
                    });
                }

                fileName = file.name;
                fileType = file.type || fileName.split('.').pop()?.toUpperCase() || 'FILE';
                fileBuffer = Buffer.from(await file.arrayBuffer());
                fileSize = fileBuffer.length;

                // 可选的 category 字段
                const categoryField = formData.get('category');
                if (categoryField && typeof categoryField === 'string') {
                    category = categoryField;
                }
            } else {
                // ===== JSON base64 方式（兼容旧前端） =====
                const data = request.body as {
                    name: string;
                    type: string;
                    size: number;
                    content: string;
                    category?: string;
                };

                if (!data.name || !data.type) {
                    return reply.status(400).send({
                        error: 'BAD_REQUEST',
                        message: '缺少文件名或类型',
                    });
                }

                fileName = data.name;
                fileType = data.type;
                fileBuffer = Buffer.from(data.content, 'base64');
                fileSize = data.size || fileBuffer.length;
                if (data.category) {
                    category = data.category;
                }
            }

            // 验证 category 值
            const validCategories = ['memory', 'knowledge', 'document'];
            if (!validCategories.includes(category)) {
                return reply.status(400).send({
                    error: 'BAD_REQUEST',
                    message: `无效的 category 值，允许: ${validCategories.join(', ')}`,
                });
            }

            // 存储文件
            const storageDir = path.join(dataRoot, 'tenants', tenantId, 'agents', id, 'documents');
            if (!existsSync(storageDir)) {
                await mkdir(storageDir, {recursive: true});
            }

            const filePath = path.join(storageDir, fileName);
            await writeFile(filePath, fileBuffer);

            // 写入数据库
            const [doc] = await db.insert(documents).values({
                templateId: id,
                tenantId,
                name: fileName,
                type: fileType,
                category,
                size: fileSize,
                path: filePath,
            }).returning();

            reply.status(201).send(doc);
        } catch (error) {
            log.error('Request failed', {detail: (error as Error).message});
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
        const {id, docId} = request.params as { id: string; docId: string };

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
            log.error('Request failed', {detail: (error as Error).message});
            reply.status(500).send({
                error: 'INTERNAL_ERROR',
                message: '删除文档失败',
            });
        }
    });
}
