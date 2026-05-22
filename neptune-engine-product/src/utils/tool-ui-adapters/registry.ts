import type * as React from 'react'
import {normalizeNameForMCP} from '../../services/mcp/normalization.js'

const CLAUDE_IN_CHROME_MCP_SERVER_NAME = 'claude-in-chrome'

export type ProductToolUiAdapterContext = {
	serverName?: string
	toolName: string
	configType?: string
}

export type ProductToolUiOverrides = Partial<{
	userFacingName(input?: Record<string, unknown>): string
	renderToolUseMessage(
		input: Record<string, unknown>,
		options: {verbose: boolean},
	): React.ReactNode
	renderToolUseTag(input: Partial<Record<string, unknown>>): React.ReactNode
	renderToolUseProgressMessage(
		progressMessagesForMessage: unknown[],
		options: {verbose: boolean},
	): React.ReactNode
	renderToolResultMessage(
		output: unknown,
		progressMessages: unknown[],
		options: {verbose: boolean; input?: unknown},
	): React.ReactNode
	isResultTruncated(output: unknown): boolean
}>

type ProductToolUiAdapter = {
	match(context: ProductToolUiAdapterContext): boolean
	getOverrides(context: ProductToolUiAdapterContext): ProductToolUiOverrides
}

function getDefaultMcpToolUiOverrides(): ProductToolUiOverrides {
	const {
		isMcpResultTruncated,
		renderMcpToolResultMessage,
		renderMcpToolUseMessage,
		renderMcpToolUseProgressMessage,
	} =
		require('./mcpDefaultRendering.js') as typeof import('./mcpDefaultRendering.js')

	return {
		renderToolUseMessage: renderMcpToolUseMessage,
		renderToolUseProgressMessage: renderMcpToolUseProgressMessage,
		renderToolResultMessage: renderMcpToolResultMessage,
		isResultTruncated(output) {
			return isMcpResultTruncated(
				typeof output === 'string' ? output : (JSON.stringify(output) ?? ''),
			)
		},
	}
}

const adapters: ProductToolUiAdapter[] = [
	{
		match({toolName}) {
			return (
				toolName === 'ListMcpResourcesTool' ||
				toolName === 'ReadMcpResourceTool'
			)
		},
		getOverrides({toolName}) {
			const {getMcpResourceToolOverrides} =
				require('./mcpResourceToolRendering.js') as typeof import('./mcpResourceToolRendering.js')
			return getMcpResourceToolOverrides(toolName)
		},
	},
	{
		match({serverName, configType}) {
			return (
				typeof serverName === 'string' &&
				normalizeNameForMCP(serverName) === CLAUDE_IN_CHROME_MCP_SERVER_NAME &&
				(configType === 'stdio' || !configType)
			)
		},
		getOverrides({toolName}) {
			// UI adapters are loaded lazily so importing the MCP client does not
			// pull React/Ink renderers unless a matching product tool is present.
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			const {getClaudeInChromeMCPToolOverrides} =
				require('../claudeInChrome/toolRendering.js') as typeof import('../claudeInChrome/toolRendering.js')
			return getClaudeInChromeMCPToolOverrides(toolName)
		},
	},
]

export function getProductToolUiOverrides(
	context: ProductToolUiAdapterContext,
): ProductToolUiOverrides {
	const defaultOverrides = getDefaultMcpToolUiOverrides()
	for (const adapter of adapters) {
		if (adapter.match(context)) {
			return {...defaultOverrides, ...adapter.getOverrides(context)}
		}
	}
	return defaultOverrides
}

export function applyProductToolUiOverrides<T extends {name: string}>(
	tool: T,
	context: Omit<ProductToolUiAdapterContext, 'toolName'> = {},
): T & ProductToolUiOverrides {
	return {
		...tool,
		...getProductToolUiOverrides({...context, toolName: tool.name}),
	}
}
