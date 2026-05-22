import * as React from 'react'
import {Box, Text, stringWidth} from '@anthropic/ink'
import {BLACK_CIRCLE} from '../../constants/figures.js'
import {MessageResponse} from '../../ui/components/MessageResponse.js'
import {homedir} from 'os'
import {isAbsolute, relative, sep} from 'path'
import {getModeColor} from '../permissions/PermissionMode.js'
import {jsonParse, jsonStringify} from '../slowOperations.js'
import {countCharInString} from '../stringUtils.js'
import {formatFileSize} from '../format.js'
import {truncateToWidthNoEllipsis} from '../truncate.js'
import type {ProductToolUiOverrides} from './registry.js'

const FILE_NOT_FOUND_CWD_NOTE = 'Note: your current working directory is'

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

type GrepOutput = {
	mode?: 'content' | 'files_with_matches' | 'count'
	numFiles: number
	filenames: string[]
	content?: string
	numLines?: number
	numMatches?: number
}

type GlobOutput = {
	durationMs: number
	numFiles: number
	filenames: string[]
	truncated: boolean
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
		case 'Grep':
			return grepOverrides
		case 'Glob':
			return globOverrides
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
		case 'TaskOutput':
			return taskOutputOverrides
		default:
			return {}
	}
}

const taskOutputOverrides: ProductToolUiOverrides = {
	get renderToolUseMessage() {
		return getTaskOutputRendering().renderToolUseMessage
	},
	get renderToolUseTag() {
		return getTaskOutputRendering().renderToolUseTag
	},
	get renderToolUseProgressMessage() {
		return getTaskOutputRendering().renderToolUseProgressMessage
	},
	get renderToolResultMessage() {
		return getTaskOutputRendering().renderToolResultMessage
	},
	get renderToolUseRejectedMessage() {
		return getTaskOutputRendering().renderToolUseRejectedMessage
	},
	get renderToolUseErrorMessage() {
		return getTaskOutputRendering().renderToolUseErrorMessage
	},
}

function getTaskOutputRendering(): typeof import('./taskOutputRendering.js') {
	return require('./taskOutputRendering.js') as typeof import('./taskOutputRendering.js')
}

const grepOverrides: ProductToolUiOverrides = {
	userFacingName() {
		return 'Search'
	},
	renderToolUseMessage(input, {verbose}) {
		const {pattern, path} = input as Partial<{pattern: string; path?: string}>
		if (!pattern) return null
		const parts = [`pattern: "${pattern}"`]
		if (path) {
			parts.push(`path: "${verbose ? path : getSearchDisplayPath(path)}"`)
		}
		return parts.join(', ')
	},
	renderToolUseErrorMessage(result, {verbose}) {
		return renderSearchToolUseErrorMessage(result, verbose)
	},
	renderToolResultMessage(output, _progressMessages, {verbose}) {
		return renderSearchToolResultMessage(output as GrepOutput, verbose)
	},
}

const globOverrides: ProductToolUiOverrides = {
	userFacingName() {
		return 'Search'
	},
	renderToolUseMessage(input, {verbose}) {
		const {pattern, path} = input as Partial<{pattern: string; path?: string}>
		if (!pattern) return null
		if (!path) return `pattern: "${pattern}"`
		return `pattern: "${pattern}", path: "${verbose ? path : getSearchDisplayPath(path)}"`
	},
	renderToolUseErrorMessage(result, {verbose}) {
		return renderSearchToolUseErrorMessage(result, verbose)
	},
	renderToolResultMessage(output, _progressMessages, {verbose}) {
		const {filenames, numFiles} = output as GlobOutput
		return renderSearchToolResultMessage(
			{
				mode: 'files_with_matches',
				filenames,
				numFiles,
			},
			verbose,
		)
	},
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

function renderSearchToolUseErrorMessage(
	result: unknown,
	verbose: boolean,
): React.ReactNode {
	if (
		!verbose &&
		typeof result === 'string' &&
		extractTag(result, 'tool_use_error')
	) {
		const errorMessage = extractTag(result, 'tool_use_error')
		if (errorMessage?.includes(FILE_NOT_FOUND_CWD_NOTE)) {
			return (
				<MessageResponse>
					<Text color="error">File not found</Text>
				</MessageResponse>
			)
		}
		return (
			<MessageResponse>
				<Text color="error">Error searching files</Text>
			</MessageResponse>
		)
	}
	return renderSearchFallbackError(result, verbose)
}

function renderSearchToolResultMessage(
	{
		mode = 'files_with_matches',
		filenames,
		numFiles,
		content,
		numLines,
		numMatches,
	}: GrepOutput,
	verbose: boolean,
): React.ReactNode {
	if (mode === 'content') {
		return (
			<SearchResultSummary
				count={numLines ?? 0}
				countLabel="lines"
				content={content}
				verbose={verbose}
			/>
		)
	}

	if (mode === 'count') {
		return (
			<SearchResultSummary
				count={numMatches ?? 0}
				countLabel="matches"
				secondaryCount={numFiles}
				secondaryLabel="files"
				content={content}
				verbose={verbose}
			/>
		)
	}

	return (
		<SearchResultSummary
			count={numFiles}
			countLabel="files"
			content={filenames.map(filename => filename).join('\n')}
			verbose={verbose}
		/>
	)
}

function SearchResultSummary({
	count,
	countLabel,
	secondaryCount,
	secondaryLabel,
	content,
	verbose,
}: {
	count: number
	countLabel: string
	secondaryCount?: number
	secondaryLabel?: string
	content?: string
	verbose: boolean
}): React.ReactNode {
	const primaryText = (
		<Text>
			Found <Text bold>{count} </Text>
			{count === 0 || count > 1 ? countLabel : countLabel.slice(0, -1)}
		</Text>
	)

	const secondaryText =
		secondaryCount !== undefined && secondaryLabel ? (
			<Text>
				{' '}
				across <Text bold>{secondaryCount} </Text>
				{secondaryCount === 0 || secondaryCount > 1
					? secondaryLabel
					: secondaryLabel.slice(0, -1)}
			</Text>
		) : null

	if (verbose) {
		return (
			<Box flexDirection="column">
				<Box flexDirection="row">
					<Text>
						<Text dimColor>&nbsp;&nbsp;⎿ &nbsp;</Text>
						{primaryText}
						{secondaryText}
					</Text>
				</Box>
				<Box marginLeft={5}>
					<Text>{content}</Text>
				</Box>
			</Box>
		)
	}

	return (
		<MessageResponse height={1}>
			<Text>
				{primaryText}
				{secondaryText} {count > 0 ? <Text dimColor>(ctrl+o to expand)</Text> : null}
			</Text>
		</MessageResponse>
	)
}

function getSearchDisplayPath(path: string): string {
	const cwd = process.cwd()
	if (isAbsolute(path)) {
		const relativePath = relative(cwd, path)
		if (relativePath && !relativePath.startsWith('..')) {
			return relativePath
		}
		const homeDir = homedir()
		if (path.startsWith(homeDir + sep)) {
			return '~' + path.slice(homeDir.length)
		}
	}
	return path
}

function extractTag(html: string, tagName: string): string | null {
	if (!html.trim() || !tagName.trim()) return null
	const escapedTag = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
	const pattern = new RegExp(
		`<${escapedTag}(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/${escapedTag}>`,
		'i',
	)
	return pattern.exec(html)?.[1] ?? null
}

function renderSearchFallbackError(
	result: unknown,
	verbose: boolean,
): React.ReactNode {
	if (typeof result !== 'string') {
		return (
			<MessageResponse>
				<Text color="error">Tool execution failed</Text>
			</MessageResponse>
		)
	}
	const error = extractTag(result, 'tool_use_error') ?? result
	const cleaned = error.replace(/<\/?error>/g, '').trim()
	const lines = verbose ? cleaned : cleaned.split('\n').slice(0, 10).join('\n')
	return (
		<MessageResponse>
			<Text color="error">{lines.startsWith('Error:') ? lines : `Error: ${lines}`}</Text>
		</MessageResponse>
	)
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
