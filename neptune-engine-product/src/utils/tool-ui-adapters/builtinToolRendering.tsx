import * as React from 'react'
import {Box, Text, stringWidth} from '@anthropic/ink'
import {BLACK_CIRCLE} from '../../constants/figures.js'
import {MessageResponse} from '../../ui/components/MessageResponse.js'
import {getModeColor} from '../permissions/PermissionMode.js'
import {jsonParse, jsonStringify} from '../slowOperations.js'
import {countCharInString} from '../stringUtils.js'
import {formatFileSize} from '../format.js'
import {truncateToWidthNoEllipsis} from '../truncate.js'
import type {ProductToolUiOverrides} from './registry.js'

type WebSearchResult = {
	tool_use_id: string
	content: Array<{title: string; url: string; snippet?: string}>
}

type WebSearchOutput = {
	query: string
	results: Array<WebSearchResult | string | null | undefined>
	durationSeconds: number
}

type WebSearchProgress = {
	type: 'query_update' | 'search_results_received'
	query: string
	resultCount?: number
}

type WebFetchOutput = {
	bytes: number
	code: number
	codeText: string
	result: string
	durationMs: number
	url: string
}

type ConfigInput = {
	setting: string
	value?: string | boolean | number
}

type ConfigOutput = {
	success: boolean
	operation?: 'get' | 'set'
	setting?: string
	value?: unknown
	newValue?: unknown
	error?: string
}

type RemoteTriggerInput = {
	action?: string
	trigger_id?: string
}

type RemoteTriggerOutput = {
	status: number
	json: string
}

type SendMessageInput = {
	to?: string
	message?: unknown
}

type SendMessageOutput = {
	message: string
	routing?: unknown
	request_id?: string
	target?: string
}

type ReviewArtifactOutput = {
	artifact: string
	title?: string
	annotationCount: number
	summary?: string
}

type TaskStopOutput = {
	command?: string
}

export function getBuiltinToolUiOverrides(
	toolName: string,
): ProductToolUiOverrides {
	switch (toolName) {
		case 'WebSearch':
			return webSearchOverrides
		case 'WebFetch':
			return webFetchOverrides
		case 'Config':
			return configOverrides
		case 'RemoteTrigger':
			return remoteTriggerOverrides
		case 'SendMessage':
			return sendMessageOverrides
		case 'ReviewArtifact':
			return reviewArtifactOverrides
		case 'EnterPlanMode':
			return enterPlanModeOverrides
		case 'TaskStop':
			return taskStopOverrides
		default:
			return {}
	}
}

const webSearchOverrides: ProductToolUiOverrides = {
	userFacingName() {
		return 'Web Search'
	},
	renderToolUseMessage(input, {verbose}) {
		const {
			query,
			allowed_domains,
			blocked_domains,
		} = input as Partial<{
			query: string
			allowed_domains?: string[]
			blocked_domains?: string[]
		}>
		if (!query) return null
		let message = `"${query}"`
		if (verbose) {
			if (allowed_domains?.length) {
				message += `, only allowing domains: ${allowed_domains.join(', ')}`
			}
			if (blocked_domains?.length) {
				message += `, blocking domains: ${blocked_domains.join(', ')}`
			}
		}
		return message
	},
	renderToolUseProgressMessage(progressMessages) {
		if (progressMessages.length === 0) return null
		const lastProgress = progressMessages.at(-1) as
			| {data?: WebSearchProgress}
			| undefined
		const data = lastProgress?.data
		if (!data) return null
		switch (data.type) {
			case 'query_update':
				return (
					<MessageResponse>
						<Text dimColor>Searching: {data.query}</Text>
					</MessageResponse>
				)
			case 'search_results_received':
				return (
					<MessageResponse>
						<Text dimColor>
							Found {data.resultCount ?? 0} results for &quot;{data.query}&quot;
						</Text>
					</MessageResponse>
				)
		}
	},
	renderToolResultMessage(output) {
		const {results = [], durationSeconds} = output as WebSearchOutput
		let searchCount = 0
		for (const result of results) {
			if (result != null && typeof result !== 'string') searchCount++
		}
		const timeDisplay =
			durationSeconds >= 1
				? `${Math.round(durationSeconds)}s`
				: `${Math.round(durationSeconds * 1000)}ms`
		return (
			<Box justifyContent="space-between" width="100%">
				<MessageResponse height={1}>
					<Text>
						Did {searchCount} search{searchCount !== 1 ? 'es' : ''} in{' '}
						{timeDisplay}
					</Text>
				</MessageResponse>
			</Box>
		)
	},
}

const webFetchOverrides: ProductToolUiOverrides = {
	renderToolUseMessage(input, {verbose}) {
		const {url, prompt} = input as Partial<{url: string; prompt: string}>
		if (!url) return null
		if (verbose) return `url: "${url}"${prompt ? `, prompt: "${prompt}"` : ''}`
		return url
	},
	renderToolUseProgressMessage() {
		return (
			<MessageResponse height={1}>
				<Text dimColor>Fetching...</Text>
			</MessageResponse>
		)
	},
	renderToolResultMessage(output, _progressMessages, {verbose}) {
		const {bytes, code, codeText, result} = output as WebFetchOutput
		const formattedSize = formatFileSize(bytes)
		if (verbose) {
			return (
				<Box flexDirection="column">
					<MessageResponse height={1}>
						<Text>
							Received <Text bold>{formattedSize}</Text> ({code} {codeText})
						</Text>
					</MessageResponse>
					<Box flexDirection="column">
						<Text>{result}</Text>
					</Box>
				</Box>
			)
		}
		return (
			<MessageResponse height={1}>
				<Text>
					Received <Text bold>{formattedSize}</Text> ({code} {codeText})
				</Text>
			</MessageResponse>
		)
	},
}

const configOverrides: ProductToolUiOverrides = {
	renderToolUseMessage(input) {
		const config = input as Partial<ConfigInput>
		if (!config.setting) return null
		if (config.value === undefined) {
			return <Text dimColor>Getting {config.setting}</Text>
		}
		return (
			<Text dimColor>
				Setting {config.setting} to {jsonStringify(config.value)}
			</Text>
		)
	},
	renderToolResultMessage(output) {
		const content = output as ConfigOutput
		if (!content.success) {
			return (
				<MessageResponse>
					<Text color="error">Failed: {content.error}</Text>
				</MessageResponse>
			)
		}
		if (content.operation === 'get') {
			return (
				<MessageResponse>
					<Text>
						<Text bold>{content.setting}</Text> = {jsonStringify(content.value)}
					</Text>
				</MessageResponse>
			)
		}
		return (
			<MessageResponse>
				<Text>
					Set <Text bold>{content.setting}</Text> to{' '}
					<Text bold>{jsonStringify(content.newValue)}</Text>
				</Text>
			</MessageResponse>
		)
	},
	renderToolUseRejectedMessage() {
		return <Text color="warning">Config change rejected</Text>
	},
}

const remoteTriggerOverrides: ProductToolUiOverrides = {
	renderToolUseMessage(input) {
		const {action, trigger_id} = input as RemoteTriggerInput
		return `${action ?? ''}${trigger_id ? ` ${trigger_id}` : ''}`
	},
	renderToolResultMessage(output) {
		const {status, json} = output as RemoteTriggerOutput
		const lines = countCharInString(json, '\n') + 1
		return (
			<MessageResponse>
				<Text>
					HTTP {status} <Text dimColor>({lines} lines)</Text>
				</Text>
			</MessageResponse>
		)
	},
}

const sendMessageOverrides: ProductToolUiOverrides = {
	renderToolUseMessage(input) {
		const {message, to} = input as SendMessageInput
		if (typeof message !== 'object' || message === null) return null
		const structured = message as {type?: string; approve?: boolean}
		if (structured.type === 'plan_approval_response') {
			return structured.approve
				? `approve plan from: ${to}`
				: `reject plan from: ${to}`
		}
		return null
	},
	renderToolResultMessage(content) {
		const result: SendMessageOutput =
			typeof content === 'string' ? jsonParse(content) : (content as SendMessageOutput)
		if (result.routing || ('request_id' in result && 'target' in result)) {
			return null
		}
		return (
			<MessageResponse>
				<Text dimColor>{result.message}</Text>
			</MessageResponse>
		)
	},
}

const reviewArtifactOverrides: ProductToolUiOverrides = {
	renderToolUseMessage(input, {verbose}) {
		const {
			title,
			annotations,
		} = input as Partial<{
			title?: string
			annotations?: Array<{line?: number; message: string; severity?: string}>
		}>
		const displayTitle = title ?? 'Untitled artifact'
		const count = annotations?.length ?? 0
		return verbose ? `Review: "${displayTitle}" (${count} annotation(s))` : displayTitle
	},
	renderToolResultMessage(output, _progressMessages, {verbose}) {
		const result = output as ReviewArtifactOutput
		if (verbose) {
			return (
				<Box flexDirection="column">
					<Text>
						Reviewed artifact: {result.title ?? 'Untitled'} (
						{result.annotationCount} annotations)
					</Text>
					{result.summary ? <Text dimColor>{result.summary}</Text> : null}
				</Box>
			)
		}
		return <Text>Review complete: {result.annotationCount} annotation(s)</Text>
	},
}

const enterPlanModeOverrides: ProductToolUiOverrides = {
	renderToolUseMessage() {
		return null
	},
	renderToolResultMessage() {
		return (
			<Box flexDirection="column" marginTop={1}>
				<Box flexDirection="row">
					<Text color={getModeColor('plan')}>{BLACK_CIRCLE}</Text>
					<Text> Entered plan mode</Text>
				</Box>
				<Box paddingLeft={2}>
					<Text dimColor>
						Claude is now exploring and designing an implementation approach.
					</Text>
				</Box>
			</Box>
		)
	},
	renderToolUseRejectedMessage() {
		return (
			<Box flexDirection="row" marginTop={1}>
				<Text color={getModeColor('default')}>{BLACK_CIRCLE}</Text>
				<Text> User declined to enter plan mode</Text>
			</Box>
		)
	},
}

const taskStopOverrides: ProductToolUiOverrides = {
	renderToolUseMessage() {
		return ''
	},
	renderToolResultMessage(output, _progressMessages, {verbose}) {
		if (process.env.USER_TYPE === 'ant') return null
		const rawCommand = (output as TaskStopOutput).command ?? ''
		const command = verbose ? rawCommand : truncateCommand(rawCommand)
		const suffix = command !== rawCommand ? '... - stopped' : ' - stopped'
		return (
			<MessageResponse>
				<Text>
					{command}
					{suffix}
				</Text>
			</MessageResponse>
		)
	},
}

function truncateCommand(command: string): string {
	const lines = command.split('\n')
	let truncated = command
	if (lines.length > 2) {
		truncated = lines.slice(0, 2).join('\n')
	}
	if (stringWidth(truncated) > 160) {
		truncated = truncateToWidthNoEllipsis(truncated, 160)
	}
	return truncated.trim()
}
