/**
 * Skill 服务类
 * 负责 Skill 模板的 CRUD 操作以及 Agent-Skill 关联管理
 */

import {db, skills, agentSkills, agentTemplates} from '../db';
import {eq, and, desc, sql, type SQL} from 'drizzle-orm';

/**
 * Skill 列表查询结果
 */
export interface SkillListResult {
    data: Array<{
        id: string;
        tenantId: string;
        name: string;
        description: string | null;
        content: string | null;
        status: string;
        createdAt: Date | null;
        updatedAt: Date | null;
    }>;
    meta: {
        count: number;
        limit: number;
        offset: number;
    };
}

/**
 * Skill 过滤器
 */
export interface SkillFilters {
    status?: string;
    limit?: number;
    offset?: number;
}

/**
 * Agent-Skill 关联信息
 */
export interface AgentSkillInfo {
    id: string;
    agentId: string;
    skillId: string;
    assignedAt: Date | null;
}

/**
 * Skill 服务类
 */
export class SkillService {
    /**
     * 创建 Skill
     * @param data Skill 数据
     * @returns 创建的 Skill
     */
    async create(data: {
        tenantId: string;
        name: string;
        description?: string;
        content?: string;
        status?: string;
    }): Promise<typeof skills.$inferSelect> {
        const [skill] = await db
            .insert(skills)
            .values({
                tenantId: data.tenantId,
                name: data.name,
                description: data.description ?? null,
                content: data.content ?? null,
                status: data.status ?? 'active',
            })
            .returning();
        return skill;
    }

    /**
     * 根据 ID 获取 Skill
     * @param id Skill ID
     * @returns Skill 信息，如果不存在则返回 null
     */
    async getSkill(id: string): Promise<typeof skills.$inferSelect | null> {
        const skill = await db.query.skills.findFirst({
            where: eq(skills.id, id),
        });
        return skill ?? null;
    }

    /**
     * 列出租户的 Skills
     * @param tenantId 租户 ID
     * @param filters 过滤条件
     * @returns Skill 列表
     */
    async listSkills(
        tenantId: string,
        filters?: SkillFilters,
    ): Promise<SkillListResult> {
        const limit = filters?.limit ?? 100;
        const offset = filters?.offset ?? 0;

        // 构建查询条件
        const conditions: SQL[] = [eq(skills.tenantId, tenantId)];

        if (filters?.status) {
            conditions.push(eq(skills.status, filters.status));
        }

        // 查询总数
        const countResult = await db
            .select({count: sql<number>`count(*)::int`})
            .from(skills)
            .where(and(...conditions));

        const count = countResult[0]?.count ?? 0;

        // 查询数据
        const results = await db
            .select()
            .from(skills)
            .where(and(...conditions))
            .orderBy(desc(skills.createdAt))
            .limit(limit)
            .offset(offset);

        return {
            data: results,
            meta: {count, limit, offset},
        };
    }

    /**
     * 更新 Skill
     * @param id Skill ID
     * @param data 更新数据
     * @returns 更新后的 Skill 信息，如果不存在则返回 null
     */
    async update(
        id: string,
        data: {
            name?: string;
            description?: string;
            content?: string;
            status?: string;
        },
    ): Promise<typeof skills.$inferSelect | null> {
        const [updated] = await db
            .update(skills)
            .set({
                ...data,
                updatedAt: new Date(),
            })
            .where(eq(skills.id, id))
            .returning();
        return updated ?? null;
    }

    /**
     * 删除 Skill
     * @param id Skill ID
     * @returns 是否删除成功
     */
    async delete(id: string): Promise<boolean> {
        const result = await db.delete(skills).where(eq(skills.id, id)).returning();
        return result.length > 0;
    }

    /**
     * 分配 Skill 给 Agent
     * @param agentId Agent ID
     * @param skillId Skill ID
     * @returns 关联信息
     */
    async assignToAgent(
        agentId: string,
        skillId: string,
    ): Promise<AgentSkillInfo | null> {
        // 检查是否已存在
        const existing = await db.query.agentSkills.findFirst({
            where: and(eq(agentSkills.agentId, agentId), eq(agentSkills.skillId, skillId)),
        });

        if (existing) {
            return {
                id: existing.id,
                agentId: existing.agentId,
                skillId: existing.skillId,
                assignedAt: existing.assignedAt,
            };
        }

        // 创建关联
        const [agentSkill] = await db
            .insert(agentSkills)
            .values({
                agentId,
                skillId,
            })
            .returning();

        return {
            id: agentSkill.id,
            agentId: agentSkill.agentId,
            skillId: agentSkill.skillId,
            assignedAt: agentSkill.assignedAt,
        };
    }

    /**
     * 从 Agent 移除 Skill
     * @param agentId Agent ID
     * @param skillId Skill ID
     * @returns 是否移除成功
     */
    async removeFromAgent(agentId: string, skillId: string): Promise<boolean> {
        const result = await db
            .delete(agentSkills)
            .where(and(eq(agentSkills.agentId, agentId), eq(agentSkills.skillId, skillId)))
            .returning();
        return result.length > 0;
    }

    /**
     * 获取 Agent 的 Skills 列表
     * @param agentId Agent ID
     * @returns Skill 列表
     */
    async getAgentSkills(agentId: string): Promise<Array<typeof skills.$inferSelect>> {
        const results = await db
            .select({
                id: skills.id,
                tenantId: skills.tenantId,
                name: skills.name,
                description: skills.description,
                content: skills.content,
                status: skills.status,
                createdAt: skills.createdAt,
                updatedAt: skills.updatedAt,
            })
            .from(agentSkills)
            .innerJoin(skills, eq(agentSkills.skillId, skills.id))
            .where(eq(agentSkills.agentId, agentId))
            .orderBy(desc(agentSkills.assignedAt));

        return results;
    }

    /**
     * 获取 Skill 的 Agents 列表
     * @param skillId Skill ID
     * @returns Agent 列表
     */
    async getSkillAgents(skillId: string): Promise<Array<typeof agentTemplates.$inferSelect>> {
        const results = await db
            .select({
                id: agentTemplates.id,
                tenantId: agentTemplates.tenantId,
                name: agentTemplates.name,
                description: agentTemplates.description,
                icon: agentTemplates.icon,
                systemPrompt: agentTemplates.systemPrompt,
                modelConfig: agentTemplates.modelConfig,
                tools: agentTemplates.tools,
                skills: agentTemplates.skills,
                mcpServers: agentTemplates.mcpServers,
                constraints: agentTemplates.constraints,
                version: agentTemplates.version,
                isActive: agentTemplates.isActive,
                createdAt: agentTemplates.createdAt,
                updatedAt: agentTemplates.updatedAt,
            })
            .from(agentSkills)
            .innerJoin(agentTemplates, eq(agentSkills.agentId, agentTemplates.id))
            .where(eq(agentSkills.skillId, skillId))
            .orderBy(desc(agentSkills.assignedAt));

        return results;
    }

    /**
     * 检查 Skill 是否属于指定租户
     * @param id Skill ID
     * @param tenantId 租户 ID
     * @returns 是否属于该租户
     */
    async belongsToTenant(id: string, tenantId: string): Promise<boolean> {
        const skill = await this.getSkill(id);
        return skill !== null && skill.tenantId === tenantId;
    }
}

/**
 * 导出单例实例
 */
export const skillService = new SkillService();
