/**
 * AgentTool inputSchema — sub-agent 启动参数（与 cc 行为对齐）
 *
 * 设计目的（Stage B2.1）：
 * - 5 个核心字段（cc AgentTool.ts:131-152 等价）：
 *   description / prompt / subagent_type / model / run_in_background
 * - 不抄 cc 的 multi-agent 字段（name / team_name / mode / isolation / cwd —— 这些是 agent teams 业务，
 *   留给 SendMessageTool / spawnTeammate 协议处理；substrate AgentTool 仅管父子关系 sub-agent）
 *
 * 设计原则：
 * - run_in_background 走 substrate TaskQueue + RunStore 协议（B4 实施），不抄 cc LocalAgentTask
 * - subagent_type 通过 ctx.kernel.agentRegistry.get(type) 查找 manifest
 * - model 三段优先级：input.model > manifest.modelHint > host 默认（B2.2 实施）
 */

import {z} from 'zod/v4'
import {lazySchema} from '../../utils/lazySchema.js'

export const inputSchema = lazySchema(() =>
	z.object({
		description: z
			.string()
			.describe('A short (3-5 word) description of the task'),
		prompt: z.string().describe('The task for the agent to perform'),
		subagent_type: z
			.string()
			.optional()
			.describe(
				'The type of specialized agent to use for this task. If omitted, the general-purpose agent is used.',
			),
		model: z
			.enum(['sonnet', 'opus', 'haiku'])
			.optional()
			.describe(
				'Optional model override for this agent. Takes precedence over the agent definition default.',
			),
		run_in_background: z
			.boolean()
			.optional()
			.describe(
				'Set to true to start this agent asynchronously and return launch metadata immediately.',
			),
	}),
)
export type InputSchema = ReturnType<typeof inputSchema>
export type AgentToolInput = z.input<InputSchema>
