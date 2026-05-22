import * as React from 'react'
import {Box, Text} from '@anthropic/ink'
import {getPrimitiveComponent} from '../componentRegistry.js'
import type {MCPToolResult} from '../mcpValidation.js'

function stringifyFallback(value: unknown): string {
	if (typeof value === 'string') return value
	return JSON.stringify(value, null, 2)
}

function extractTextContent(output: MCPToolResult): React.ReactNode {
	if (!output) {
		return <Text dimColor>(No content)</Text>
	}

	if (typeof output === 'string') {
		return <Text>{output}</Text>
	}

	return (
		<Box flexDirection="column">
			{output.map((block, index) => {
				if (block.type === 'image') {
					return <Text key={index}>[Image]</Text>
				}
				if (block.type === 'text' && 'text' in block) {
					return <Text key={index}>{String(block.text ?? '')}</Text>
				}
				return <Text key={index}>{stringifyFallback(block)}</Text>
			})}
		</Box>
	)
}

export function renderProductMCPToolResultMessage(
	output: MCPToolResult,
	{verbose}: {verbose: boolean},
): React.ReactNode {
	if (!verbose) {
		return null
	}

	const MessageResponse = getPrimitiveComponent('MessageResponse')
	const content = extractTextContent(output)

	if (!MessageResponse) {
		return content
	}

	return <MessageResponse>{content}</MessageResponse>
}
