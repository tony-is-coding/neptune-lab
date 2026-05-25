import type {ToolResultBlockParam} from '../../tool.js'

type TextBlock = Extract<
	NonNullable<ToolResultBlockParam['content']>[number],
	{type: 'text'}
>

type AgentContentBlock = NonNullable<ToolResultBlockParam['content']>[number]

export type AgentCompletedResult = {
	status: 'completed'
	agentId: string
	agentType?: string
	content: AgentContentBlock[]
	totalTokens: number
	totalToolUseCount: number
	totalDurationMs: number
	worktreePath?: string
	worktreeBranch?: string
}

export type AgentAsyncLaunchedResult = {
	status: 'async_launched'
	agentId: string
	outputFile: string
	canReadOutputFile?: boolean
}

export type AgentTeammateSpawnedResult = {
	status: 'teammate_spawned'
	teammate_id: string
	name: string
	team_name?: string
}

export type AgentRemoteLaunchedResult = {
	status: 'remote_launched'
	taskId: string
	sessionUrl: string
	outputFile: string
}

type AgentResult =
	| AgentCompletedResult
	| AgentAsyncLaunchedResult
	| AgentTeammateSpawnedResult
	| AgentRemoteLaunchedResult

const ONE_SHOT_BUILTIN_AGENT_TYPES = new Set(['Explore', 'Plan'])

function textBlock(text: string): TextBlock {
	return {
		type: 'text',
		text,
	}
}

export function mapAgentToolResultToBlock(
	data: AgentResult,
	toolUseID: string,
): ToolResultBlockParam {
	if (data.status === 'teammate_spawned') {
		return {
			tool_use_id: toolUseID,
			type: 'tool_result',
			content: [
				textBlock(`Spawned successfully.
agent_id: ${data.teammate_id}
name: ${data.name}
team_name: ${data.team_name ?? ''}`),
			],
		}
	}

	if (data.status === 'remote_launched') {
		return {
			tool_use_id: toolUseID,
			type: 'tool_result',
			content: [
				textBlock(
					`Remote agent launched.\ntaskId: ${data.taskId}\nsession_url: ${data.sessionUrl}\noutput_file: ${data.outputFile}`,
				),
			],
		}
	}

	if (data.status === 'async_launched') {
		const outputFileText = data.canReadOutputFile
			? `\noutput_file: ${data.outputFile}`
			: ''
		return {
			tool_use_id: toolUseID,
			type: 'tool_result',
			content: [
				textBlock(`Async agent launched.\nagentId: ${data.agentId}${outputFileText}`),
			],
		}
	}

	const worktreeInfoText = data.worktreePath
		? `\nworktreePath: ${data.worktreePath}\nworktreeBranch: ${data.worktreeBranch ?? ''}`
		: ''
	const contentOrMarker =
		data.content.length > 0
			? data.content
			: [textBlock('(Subagent completed but returned no output.)')]

	if (
		data.agentType &&
		ONE_SHOT_BUILTIN_AGENT_TYPES.has(data.agentType) &&
		!worktreeInfoText
	) {
		return {
			tool_use_id: toolUseID,
			type: 'tool_result',
			content: contentOrMarker,
		}
	}

	return {
		tool_use_id: toolUseID,
		type: 'tool_result',
		content: [
			...contentOrMarker,
			textBlock(`agentId: ${data.agentId}${worktreeInfoText}
<usage>total_tokens: ${data.totalTokens}
tool_uses: ${data.totalToolUseCount}
duration_ms: ${data.totalDurationMs}</usage>`),
		],
	}
}
