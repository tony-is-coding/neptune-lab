import * as React from 'react'
import {Box, Text} from '@anthropic/ink'
import {MessageResponse} from '../../ui/components/MessageResponse.js'
import {OutputLine} from '../../ui/components/shell/OutputLine.js'
import {isOutputLineTruncated} from '../../ui/terminal.js'
import {jsonStringify} from '../slowOperations.js'

export const LIST_MCP_RESOURCES_TOOL_NAME = 'ListMcpResourcesTool'
export const READ_MCP_RESOURCE_TOOL_NAME = 'ReadMcpResourceTool'

type ListMcpResourcesInput = Partial<{server?: unknown}>
type ReadMcpResourceInput = Partial<{server?: unknown; uri?: unknown}>
type McpResourceToolOutput = unknown

export function getMcpResourceToolOverrides(
	toolName: string,
): {
	userFacingName?: () => string
	renderToolUseMessage?: (input: Record<string, unknown>) => React.ReactNode
	renderToolResultMessage?: (
		output: McpResourceToolOutput,
		progressMessages: unknown[],
		options: {verbose: boolean},
	) => React.ReactNode
	isResultTruncated?: (output: McpResourceToolOutput) => boolean
} {
	if (toolName === LIST_MCP_RESOURCES_TOOL_NAME) {
		return {
			userFacingName: () => 'listMcpResources',
			renderToolUseMessage: renderListMcpResourcesToolUseMessage,
			renderToolResultMessage: renderListMcpResourcesToolResultMessage,
			isResultTruncated: isMcpResourceToolResultTruncated,
		}
	}
	if (toolName === READ_MCP_RESOURCE_TOOL_NAME) {
		return {
			userFacingName: () => 'readMcpResource',
			renderToolUseMessage: renderReadMcpResourceToolUseMessage,
			renderToolResultMessage: renderReadMcpResourceToolResultMessage,
			isResultTruncated: isMcpResourceToolResultTruncated,
		}
	}
	return {}
}

function renderListMcpResourcesToolUseMessage(
	input: ListMcpResourcesInput,
): React.ReactNode {
	return typeof input.server === 'string' && input.server.length > 0
		? `List MCP resources from server "${input.server}"`
		: `List all MCP resources`
}

function renderReadMcpResourceToolUseMessage(
	input: ReadMcpResourceInput,
): React.ReactNode {
	if (typeof input.uri !== 'string' || typeof input.server !== 'string') {
		return null
	}
	return `Read resource "${input.uri}" from server "${input.server}"`
}

function renderListMcpResourcesToolResultMessage(
	output: McpResourceToolOutput,
	_progressMessages: unknown[],
	{verbose}: {verbose: boolean},
): React.ReactNode {
	if (!Array.isArray(output) || output.length === 0) {
		return (
			<MessageResponse height={1}>
				<Text dimColor>(No resources found)</Text>
			</MessageResponse>
		)
	}
	return <OutputLine content={jsonStringify(output, null, 2)} verbose={verbose} />
}

function renderReadMcpResourceToolResultMessage(
	output: McpResourceToolOutput,
	_progressMessages: unknown[],
	{verbose}: {verbose: boolean},
): React.ReactNode {
	if (!hasReadableMcpResourceContent(output)) {
		return (
			<Box justifyContent="space-between" overflowX="hidden" width="100%">
				<MessageResponse height={1}>
					<Text dimColor>(No content)</Text>
				</MessageResponse>
			</Box>
		)
	}
	return <OutputLine content={jsonStringify(output, null, 2)} verbose={verbose} />
}

function hasReadableMcpResourceContent(
	output: McpResourceToolOutput,
): output is {contents: unknown[]} {
	return (
		typeof output === 'object' &&
		output !== null &&
		'contents' in output &&
		Array.isArray((output as {contents?: unknown}).contents) &&
		(output as {contents: unknown[]}).contents.length > 0
	)
}

function isMcpResourceToolResultTruncated(output: McpResourceToolOutput): boolean {
	return isOutputLineTruncated(jsonStringify(output))
}
