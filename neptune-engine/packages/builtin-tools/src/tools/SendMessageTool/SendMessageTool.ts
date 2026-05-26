/**
 * SendMessageTool — substrate agent teams 通信工具（P0.5 重写）
 *
 * 设计目的：
 * - 走 substrate TeammateChannel 协议（B1.4 已落）
 * - 完整剥 13 处 `from '../../../../../src/...'` cc 业务依赖
 * - cc 业务版（含 UDS/bridge/TCP/tmux 多路由）保留 product/cc-tools/SendMessageTool/ 作参考
 *
 * 流程（与 cc 行为对齐 — TeammateChannel 协议）：
 * - to='*' + plain text → ctx.kernel.teammateChannel.broadcast(team, sender, msg)
 * - to=name + plain text → ctx.kernel.teammateChannel.send(team, recipient, msg)
 * - to=name + structured → encode 后 send（不允许 broadcast 结构化消息）
 *
 * 业务剥离（cc → substrate）：
 * - 不抄 UDS / bridge / TCP / tmux 路由（红线 #4 — agent teams 后端业务由 product 注入）
 * - 不抄 LocalAgentTask 队列推送 / resumeAgentBackground 业务
 * - 不抄 swarm 配置 / TEAM_LEAD_NAME 默认值
 * - cc 完整版保留 product/cc-tools/ 作参考
 */

import {z} from 'zod/v4'
import type {
	StructuredMessage,
	TeammateChannel,
} from '@neptune/engine'
import {encodeStructuredMessage} from '@neptune/engine'
import {requireProtocol, type KernelToolContext} from '../../kernel-context.js'
import {buildTool, type ToolDef} from '../../tool.js'
import {lazySchema} from '../../utils/lazySchema.js'
import {SEND_MESSAGE_TOOL_NAME} from './constants.js'
import {DESCRIPTION, getPrompt} from './prompt.js'

// ============================================================
// Schema（与 cc SendMessageTool 字段一致 — to + summary? + message）
// ============================================================

const StructuredMessageSchema = lazySchema(() =>
	z.discriminatedUnion('type', [
		z.object({
			type: z.literal('shutdown_request'),
			request_id: z.string(),
			reason: z.string().optional(),
		}),
		z.object({
			type: z.literal('shutdown_response'),
			request_id: z.string(),
			approve: z.boolean(),
			reason: z.string().optional(),
		}),
		z.object({
			type: z.literal('plan_approval_response'),
			request_id: z.string(),
			approve: z.boolean(),
			feedback: z.string().optional(),
		}),
	]),
)

const inputSchema = lazySchema(() =>
	z.object({
		to: z
			.string()
			.describe('Recipient: a specific teammate name, or "*" for broadcast'),
		summary: z
			.string()
			.optional()
			.describe(
				'A 5-10 word summary shown as a preview in the UI (required when message is a string)',
			),
		message: z.union([z.string(), StructuredMessageSchema()]),
	}),
)
type InputSchema = ReturnType<typeof inputSchema>
type Input = z.input<InputSchema>

// ============================================================
// Output 类型
// ============================================================

interface MessageOutput {
	success: boolean
	message: string
	target: string
}

interface BroadcastOutput {
	success: boolean
	message: string
	target: string
	recipients: readonly string[]
}

type Output = MessageOutput | BroadcastOutput

// ============================================================
// Helper: 取 sender + team
// ============================================================

interface SendMessageContext extends KernelToolContext {
	/** 当前 agent 名（broadcast/from 字段用）。host 通过 ctx.agentName 注入。 */
	agentName?: string
	/** 当前 team 名（mailbox 隔离）。host 通过 ctx.teamName 注入。 */
	teamName?: string
	/** 颜色 / summary 等 UI metadata 直接由 caller 传入 input 字段。 */
}

function getSender(ctx: SendMessageContext): string {
	return ctx.agentName ?? 'parent'
}

function getTeamName(ctx: SendMessageContext): string {
	return ctx.teamName ?? 'default'
}

// ============================================================
// SendMessageTool 主体
// ============================================================

export const SendMessageTool = buildTool({
	name: SEND_MESSAGE_TOOL_NAME,
	searchHint: 'send messages to teammates in agent teams (mailbox protocol)',
	maxResultSizeChars: 100_000,

	get inputSchema(): InputSchema {
		return inputSchema()
	},

	async description(): Promise<string> {
		return DESCRIPTION
	},

	async prompt(): Promise<string> {
		return getPrompt()
	},

	isReadOnly(input?: Input): boolean {
		return typeof input?.message === 'string'
	},

	async checkPermissions(input) {
		return {behavior: 'allow' as const, updatedInput: input}
	},

	async validateInput(input: Input) {
		if (input.to.trim().length === 0) {
			return {result: false, message: '`to` must not be empty', errorCode: 9}
		}
		if (input.to.includes('@')) {
			return {
				result: false,
				message: '`to` must be a bare teammate name or "*" — no @ separator',
				errorCode: 9,
			}
		}
		// plain text: summary required
		if (typeof input.message === 'string') {
			if (!input.summary || input.summary.trim().length === 0) {
				return {
					result: false,
					message: '`summary` is required when message is a string',
					errorCode: 9,
				}
			}
			return {result: true}
		}
		// structured: 不允许 broadcast
		if (input.to === '*') {
			return {
				result: false,
				message: 'structured messages cannot be broadcast (to: "*")',
				errorCode: 9,
			}
		}
		return {result: true}
	},

	async call(input: Input, context) {
		const ctx = context as SendMessageContext
		const channel: TeammateChannel = requireProtocol(ctx, 'teammateChannel')
		const teamName = getTeamName(ctx)
		const sender = getSender(ctx)

		// plain text
		if (typeof input.message === 'string') {
			if (input.to === '*') {
				const recipients = await channel.broadcast(teamName, sender, {
					from: sender,
					text: input.message,
					summary: input.summary,
				})
				const out: BroadcastOutput = {
					success: true,
					message:
						recipients.length === 0
							? 'No teammates to broadcast to'
							: `Broadcast to ${recipients.length} teammate(s): ${recipients.join(', ')}`,
					target: '*',
					recipients,
				}
				return {data: out as Output}
			}
			await channel.send(teamName, input.to, {
				from: sender,
				text: input.message,
				summary: input.summary,
			})
			const out: MessageOutput = {
				success: true,
				message: `Message sent to ${input.to}`,
				target: input.to,
			}
			return {data: out as Output}
		}

		// structured message: encode + send（不广播）
		const encoded = encodeStructuredMessage(input.message as StructuredMessage)
		await channel.send(teamName, input.to, {
			from: sender,
			text: encoded,
		})
		const out: MessageOutput = {
			success: true,
			message: `Structured message [${(input.message as StructuredMessage).type}] sent to ${input.to}`,
			target: input.to,
		}
		return {data: out as Output}
	},

	mapToolResultToToolResultBlockParam(result, toolUseID) {
		const data = result as Output
		const summary = JSON.stringify({
			success: data.success,
			target: data.target,
			...(data as BroadcastOutput).recipients !== undefined && {
				recipients: (data as BroadcastOutput).recipients,
			},
			message: data.message,
		})
		return {
			tool_use_id: toolUseID,
			type: 'tool_result',
			content: summary,
		}
	},
} satisfies ToolDef<InputSchema, Output>)

export {SEND_MESSAGE_TOOL_NAME}
