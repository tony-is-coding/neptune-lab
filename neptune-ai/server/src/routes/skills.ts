/**
 * Skills 管理路由
 *
 * 提供 Skills CRUD 和 Agent-Skill 关联管理的 API 端点
 */

import type {FastifyInstance} from 'fastify';
import {skillService} from '../services/skill';
import {roleMiddleware} from '../middleware/auth';
import {createLogger} from '../utils/logger';

const log = createLogger('routes:skills');

/**
 * Skills 路由
 */
export async function skillRoutes(fastify: FastifyInstance) {
    /**
     * POST /api/v1/skills
     * 创建 Skill（仅管理员）
     */
    fastify.post('/', {
        preHandler: [fastify.authenticate, roleMiddleware('admin')],
    }, async (request, reply) => {
        const {
            name,
            description,
            content,
            status,
        } = request.body as {
            name: string;
            description?: string;
            content?: string;
            status?: string;
        };

        const tenantId = request.user!.tenantId;

        if (!name) {
            return reply.status(400).send({
                error: 'BAD_REQUEST',
                message: '缺少必填字段: name',
            });
        }

        // 验证 status
        if (status && !['active', 'draft'].includes(status)) {
            return reply.status(400).send({
                error: 'BAD_REQUEST',
                message: 'status 必须是 active 或 draft',
            });
        }

        try {
            const skill = await skillService.create({
                tenantId,
                name,
                description,
                content,
                status,
            });

            reply.status(201).send(skill);
        } catch (error) {
            log.error('Request failed', {detail: (error as Error).message});
            reply.status(500).send({
                error: 'INTERNAL_ERROR',
                message: '创建 Skill 失败',
            });
        }
    });

    /**
     * GET /api/v1/skills/:id
     * 获取 Skill 详情
     */
    fastify.get('/:id', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        const {id} = request.params as { id: string };
        const tenantId = request.user!.tenantId;

        try {
            const skill = await skillService.getSkill(id);

            if (!skill) {
                return reply.status(404).send({
                    error: 'NOT_FOUND',
                    message: 'Skill 不存在',
                });
            }

            // 验证租户权限
            if (skill.tenantId !== tenantId) {
                return reply.status(404).send({
                    error: 'NOT_FOUND',
                    message: 'Skill 不存在',
                });
            }

            reply.send(skill);
        } catch (error) {
            log.error('Request failed', {detail: (error as Error).message});
            reply.status(500).send({
                error: 'INTERNAL_ERROR',
                message: '获取 Skill 失败',
            });
        }
    });

    /**
     * GET /api/v1/skills
     * 获取当前租户的 Skills 列表
     */
    fastify.get('/', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        const {status, limit, offset} = request.query as {
            status?: string;
            limit?: string;
            offset?: string;
        };

        const tenantId = request.user!.tenantId;

        try {
            const result = await skillService.listSkills(tenantId, {
                status,
                limit: limit ? parseInt(limit, 10) : undefined,
                offset: offset ? parseInt(offset, 10) : undefined,
            });

            reply.send(result);
        } catch (error) {
            log.error('Request failed', {detail: (error as Error).message});
            reply.status(500).send({
                error: 'INTERNAL_ERROR',
                message: '获取 Skills 列表失败',
            });
        }
    });

    /**
     * PUT /api/v1/skills/:id
     * 更新 Skill（仅管理员）
     */
    fastify.put('/:id', {
        preHandler: [fastify.authenticate, roleMiddleware('admin')],
    }, async (request, reply) => {
        const {id} = request.params as { id: string };
        const {
            name,
            description,
            content,
            status,
        } = request.body as {
            name?: string;
            description?: string;
            content?: string;
            status?: string;
        };

        const tenantId = request.user!.tenantId;

        try {
            // 验证 status
            if (status && !['active', 'draft'].includes(status)) {
                return reply.status(400).send({
                    error: 'BAD_REQUEST',
                    message: 'status 必须是 active 或 draft',
                });
            }

            // 检查权限
            const belongsToTenant = await skillService.belongsToTenant(id, tenantId);
            if (!belongsToTenant) {
                return reply.status(404).send({
                    error: 'NOT_FOUND',
                    message: 'Skill 不存在',
                });
            }

            const skill = await skillService.update(id, {
                name,
                description,
                content,
                status,
            });

            if (!skill) {
                return reply.status(404).send({
                    error: 'NOT_FOUND',
                    message: 'Skill 不存在',
                });
            }

            reply.send(skill);
        } catch (error) {
            log.error('Request failed', {detail: (error as Error).message});
            reply.status(500).send({
                error: 'INTERNAL_ERROR',
                message: '更新 Skill 失败',
            });
        }
    });

    /**
     * DELETE /api/v1/skills/:id
     * 删除 Skill（仅管理员）
     */
    fastify.delete('/:id', {
        preHandler: [fastify.authenticate, roleMiddleware('admin')],
    }, async (request, reply) => {
        const {id} = request.params as { id: string };
        const tenantId = request.user!.tenantId;

        try {
            // 检查权限
            const belongsToTenant = await skillService.belongsToTenant(id, tenantId);
            if (!belongsToTenant) {
                return reply.status(404).send({
                    error: 'NOT_FOUND',
                    message: 'Skill 不存在',
                });
            }

            const success = await skillService.delete(id);

            if (!success) {
                return reply.status(404).send({
                    error: 'NOT_FOUND',
                    message: 'Skill 不存在',
                });
            }

            reply.status(204).send();
        } catch (error) {
            log.error('Request failed', {detail: (error as Error).message});
            reply.status(500).send({
                error: 'INTERNAL_ERROR',
                message: '删除 Skill 失败',
            });
        }
    });

    /**
     * POST /api/v1/skills/:skillId/agents/:agentId
     * 分配 Skill 给 Agent
     */
    fastify.post('/:skillId/agents/:agentId', {
        preHandler: [fastify.authenticate, roleMiddleware('admin')],
    }, async (request, reply) => {
        const {skillId, agentId} = request.params as { skillId: string; agentId: string };
        const tenantId = request.user!.tenantId;

        try {
            // 检查 Skill 是否属于当前租户
            const belongsToTenant = await skillService.belongsToTenant(skillId, tenantId);
            if (!belongsToTenant) {
                return reply.status(404).send({
                    error: 'NOT_FOUND',
                    message: 'Skill 不存在',
                });
            }

            const result = await skillService.assignToAgent(agentId, skillId);

            reply.status(201).send(result);
        } catch (error) {
            log.error('Request failed', {detail: (error as Error).message});
            reply.status(500).send({
                error: 'INTERNAL_ERROR',
                message: '分配 Skill 失败',
            });
        }
    });

    /**
     * DELETE /api/v1/skills/:skillId/agents/:agentId
     * 从 Agent 移除 Skill
     */
    fastify.delete('/:skillId/agents/:agentId', {
        preHandler: [fastify.authenticate, roleMiddleware('admin')],
    }, async (request, reply) => {
        const {skillId, agentId} = request.params as { skillId: string; agentId: string };
        const tenantId = request.user!.tenantId;

        try {
            // 检查 Skill 是否属于当前租户
            const belongsToTenant = await skillService.belongsToTenant(skillId, tenantId);
            if (!belongsToTenant) {
                return reply.status(404).send({
                    error: 'NOT_FOUND',
                    message: 'Skill 不存在',
                });
            }

            const success = await skillService.removeFromAgent(agentId, skillId);

            if (!success) {
                return reply.status(404).send({
                    error: 'NOT_FOUND',
                    message: '关联不存在',
                });
            }

            reply.status(204).send();
        } catch (error) {
            log.error('Request failed', {detail: (error as Error).message});
            reply.status(500).send({
                error: 'INTERNAL_ERROR',
                message: '移除 Skill 失败',
            });
        }
    });

    /**
     * GET /api/v1/skills/:skillId/agents
     * 获取使用指定 Skill 的 Agent 列表
     */
    fastify.get('/:skillId/agents', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        const {skillId} = request.params as { skillId: string };
        const tenantId = request.user!.tenantId;

        try {
            // 检查 Skill 是否属于当前租户
            const belongsToTenant = await skillService.belongsToTenant(skillId, tenantId);
            if (!belongsToTenant) {
                return reply.status(404).send({
                    error: 'NOT_FOUND',
                    message: 'Skill 不存在',
                });
            }

            const agents = await skillService.getSkillAgents(skillId);

            reply.send({
                data: agents,
                meta: {
                    count: agents.length,
                },
            });
        } catch (error) {
            log.error('Request failed', {detail: (error as Error).message});
            reply.status(500).send({
                error: 'INTERNAL_ERROR',
                message: '获取 Agent 列表失败',
            });
        }
    });

    /**
     * GET /api/v1/agents/:agentId/skills
     * 获取 Agent 的 Skills 列表
     * 注意：这个端点在 agents.ts 中注册，但逻辑在这里实现
     */
    // 此路由将在 agents.ts 中注册，调用 skillService.getAgentSkills
}
