import {BASH_TOOL_NAME} from '@neptune/builtin-tools/tools/BashTool/toolName.js'
import {SEND_MESSAGE_TOOL_NAME} from '@neptune/builtin-tools/tools/SendMessageTool/constants.js'
import type {Tool, ToolResultBlockParam} from '../../Tool.js'

const FILE_READ_TOOL_NAME = 'Read'

type TextBlock = Extract<
	NonNullable<ToolResultBlockParam['content']>[number],
	{type: 'text'}
>

type AgentRuntimeOutput =
	| {
			status: 'async_launched'
			agentId: string
			outputFile: string
			canReadOutputFile?: boolean
	  }
	| {
			status: 'remote_launched'
			taskId: string
			sessionUrl: string
			outputFile: string
	  }
	| {
			status: 'completed'
			agentId: string
			agentType?: string
	  }
	| {
			status: 'teammate_spawned'
	  }

const ONE_SHOT_BUILTIN_AGENT_TYPES = new Set(['Explore', 'Plan'])

function appendText(
	block: ToolResultBlockParam,
	text: string,
): ToolResultBlockParam {
	const content = Array.isArray(block.content) ? block.content : []
	return {
		...block,
		content: [
			...content,
			{
				type: 'text',
				text,
			} satisfies TextBlock,
		],
	}
}

function getAgentDeliveryResultText(data: AgentRuntimeOutput): string | null {
	if (data.status === 'async_launched') {
		const continuation = `Use ${SEND_MESSAGE_TOOL_NAME} with to: '${data.agentId}' to continue this agent if needed.`
		const progress = data.canReadOutputFile
			? `If the user asks for a progress check before completion, use ${FILE_READ_TOOL_NAME} or ${BASH_TOOL_NAME} tail on output_file: ${data.outputFile}.`
			: 'Agent results will arrive in a subsequent message.'
		return `The agent is working in the background. You will be notified automatically when it completes. ${continuation}
Do not duplicate this agent's work. Work on non-overlapping tasks, or briefly tell the user what you launched and end your response.
${progress}`
	}

	if (data.status === 'remote_launched') {
		return `Remote agent launched in CCR. The agent is running remotely and you will be notified automatically when it completes.
Briefly tell the user what you launched and end your response.`
	}

	if (data.status === 'completed') {
		if (
			data.agentType &&
			ONE_SHOT_BUILTIN_AGENT_TYPES.has(data.agentType)
		) {
			return null
		}
		return `Use ${SEND_MESSAGE_TOOL_NAME} with to: '${data.agentId}' to continue this agent if needed.`
	}

	return null
}

export function applyAgentDeliveryResultMapping(tool: Tool): Tool {
	return {
		...tool,
		mapToolResultToToolResultBlockParam(output, toolUseID) {
			const block = tool.mapToolResultToToolResultBlockParam(output, toolUseID)
			const data = output as AgentRuntimeOutput
			if (
				typeof data !== 'object' ||
				data === null ||
				!('status' in data)
			) {
				return block
			}

			const text = getAgentDeliveryResultText(data)
			return text ? appendText(block, text) : block
		},
	}
}
