/**
 * SkillTool outputSchema — skill 启动后 sub-agent 完成结果
 *
 * 简化版 cc SkillTool 的 forked 形态（剥 inline / canonical / plugin）。
 * 仅 completed 单形态：success + skillName + content + token usage。
 */

import {z} from 'zod/v4'
import {lazySchema} from '../../utils/lazySchema.js'

export const outputSchema = lazySchema(() =>
	z.object({
		status: z.literal('completed'),
		success: z.boolean(),
		skillName: z.string(),
		agentId: z.string(),
		content: z.array(z.object({type: z.literal('text'), text: z.string()})),
		totalToolUseCount: z.number(),
		totalDurationMs: z.number(),
		totalTokens: z.number(),
		args: z.string().optional(),
	}),
)
export type OutputSchema = ReturnType<typeof outputSchema>
export type Output = z.input<OutputSchema>
