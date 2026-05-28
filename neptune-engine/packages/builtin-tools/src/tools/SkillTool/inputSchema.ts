/**
 * SkillTool inputSchema — invoke skill 启动参数
 *
 * 与 cc SkillTool 对齐：仅 skill name + 可选 args。
 * substrate 不抄 cc 的 slash-command / plugin marketplace / EXPERIMENTAL_SKILL_SEARCH 业务，
 * skill 通过 ctx.kernel.skillRegistry 查找 SkillManifest。
 */

import {z} from 'zod/v4'
import {lazySchema} from '../../utils/lazySchema.js'

export const inputSchema = lazySchema(() =>
	z.object({
		skill: z
			.string()
			.describe('The skill name (must be registered in SkillRegistry)'),
		args: z
			.string()
			.optional()
			.describe('Optional arguments forwarded to the skill as user prompt'),
	}),
)
export type InputSchema = ReturnType<typeof inputSchema>
export type SkillToolInput = z.input<InputSchema>
