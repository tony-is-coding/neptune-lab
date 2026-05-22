import * as React from 'react'
import {Box, Text} from '@anthropic/ink'
import type {ToolUseBlockParam} from '@anthropic-ai/sdk/resources/index.mjs'
import type {ProgressMessage} from '../../types/message.js'
import {MessageResponse} from '../../ui/components/MessageResponse.js'

type AgentProgressData = {
	type?: string
	message?: {
		type?: string
		message?: {
			content?: unknown
		}
	}
	prompt?: string
}

function getAssistantSummary(message: AgentProgressData['message']): string | null {
	const content = message?.message?.content
	if (!Array.isArray(content)) return null

	const toolUse = content.find(
		(block): block is ToolUseBlockParam =>
			typeof block === 'object' &&
			block !== null &&
			'type' in block &&
			block.type === 'tool_use',
	)
	if (toolUse) {
		return `Using ${toolUse.name}`
	}

	return content
		.filter((block): block is {type: 'text'; text: string} =>
			typeof block === 'object' &&
			block !== null &&
			'type' in block &&
			block.type === 'text' &&
			'text' in block &&
			typeof block.text === 'string',
		)
		.map(block => block.text)
		.join(' ')
		.trim()
		.slice(0, 160) || null
}

function getProgressSummary(progressMessages: ProgressMessage<AgentProgressData>[]): string {
	const last = progressMessages.at(-1)
	if (!last) return 'Initializing agent…'

	const nestedMessage = last.data.message
	if (!nestedMessage) return 'Running agent…'

	if (nestedMessage.type === 'assistant') {
		return getAssistantSummary(nestedMessage) ?? 'Thinking…'
	}

	if (nestedMessage.type === 'user') {
		return 'Received tool result'
	}

	return 'Running agent…'
}

export function renderToolUseProgressMessage(
	progressMessages: ProgressMessage<AgentProgressData>[],
	_options: {tools: unknown; verbose: boolean},
): React.ReactNode {
	const summary = getProgressSummary(progressMessages)

	return (
		<MessageResponse height={1}>
			<Box flexDirection="row">
				<Text dimColor>• {summary}</Text>
			</Box>
		</MessageResponse>
	)
}
