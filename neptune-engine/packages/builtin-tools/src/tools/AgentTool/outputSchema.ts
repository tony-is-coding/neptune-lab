/**
 * AgentTool outputSchema — sub-agent 完成结果（与 cc 行为对齐）
 *
 * 设计目的（Stage B2.1）：
 * 双形态 union（cc AgentTool.ts:271-291 等价）：
 * - completed: 同步完成，含 agentId / agentType / content / token usage / 时长
 * - async_launched: 后台启动，含 agentId / outputFile（runStore 路径）
 */

import {z} from 'zod/v4'
import {lazySchema} from '../../utils/lazySchema.js'

const completedOutputSchema = lazySchema(() =>
	z.object({
		status: z.literal('completed'),
		agentId: z.string(),
		agentType: z.string().optional(),
		content: z.array(z.object({type: z.literal('text'), text: z.string()})),
		totalToolUseCount: z.number(),
		totalDurationMs: z.number(),
		totalTokens: z.number(),
		usage: z.object({
			input_tokens: z.number(),
			output_tokens: z.number(),
			cache_creation_input_tokens: z.number(),
			cache_read_input_tokens: z.number(),
		}),
		prompt: z.string(),
	}),
)

const asyncLaunchedOutputSchema = lazySchema(() =>
	z.object({
		status: z.literal('async_launched'),
		agentId: z.string(),
		runId: z.string().describe('RunStore run id, used for resume / status query'),
		taskId: z
			.string()
			.optional()
			.describe('TaskQueue task id, optional for callers that use the queue'),
		description: z.string(),
		prompt: z.string(),
	}),
)

export const outputSchema = lazySchema(() =>
	z.union([completedOutputSchema(), asyncLaunchedOutputSchema()]),
)
export type OutputSchema = ReturnType<typeof outputSchema>
export type Output = z.input<OutputSchema>

/** 单独导出两个分支，方便 type narrow */
export type CompletedOutput = z.input<ReturnType<typeof completedOutputSchema>>
export type AsyncLaunchedOutput = z.input<
	ReturnType<typeof asyncLaunchedOutputSchema>
>
