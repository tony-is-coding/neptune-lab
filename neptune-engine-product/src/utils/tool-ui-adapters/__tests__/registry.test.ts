import {describe, expect, mock, test} from 'bun:test'

let chromeRendererLoaded = false
let defaultRendererLoaded = false

mock.module('../mcpDefaultRendering.js', () => ({
	isMcpResultTruncated(output: string) {
		defaultRendererLoaded = true
		return output.includes('\n')
	},
	renderMcpToolResultMessage() {
		defaultRendererLoaded = true
		return 'default-result'
	},
	renderMcpToolUseMessage() {
		defaultRendererLoaded = true
		return 'default-use'
	},
	renderMcpToolUseProgressMessage() {
		defaultRendererLoaded = true
		return 'default-progress'
	},
}))

mock.module('../../claudeInChrome/toolRendering.js', () => ({
	getClaudeInChromeMCPToolOverrides(toolName: string) {
		chromeRendererLoaded = true
		return {
			userFacingName() {
				return `Chrome[${toolName}]`
			},
		}
	},
}))

mock.module('../mcpResourceToolRendering.js', () => ({
	getMcpResourceToolOverrides(toolName: string) {
		if (toolName === 'ListMcpResourcesTool') {
			return {
				userFacingName() {
					return 'listMcpResources'
				},
				renderToolUseMessage(input: Record<string, unknown>) {
					return typeof input.server === 'string'
						? `List MCP resources from server "${input.server}"`
						: `List all MCP resources`
				},
				isResultTruncated(output: string) {
					return output.includes('\n')
				},
			}
		}
		if (toolName === 'ReadMcpResourceTool') {
			return {
				userFacingName() {
					return 'readMcpResource'
				},
				renderToolUseMessage(input: Record<string, unknown>) {
					return typeof input.server === 'string' && typeof input.uri === 'string'
						? `Read resource "${input.uri}" from server "${input.server}"`
						: null
				},
			}
		}
		return {}
	},
}))

const {applyProductToolUiOverrides, getProductToolUiOverrides} = await import(
	'../registry.js'
)

describe('product tool UI adapter registry', () => {
	test('returns product UI overrides for built-in MCP resource tools', () => {
		const listOverrides = getProductToolUiOverrides({
			serverName: '',
			toolName: 'ListMcpResourcesTool',
		})
		const readOverrides = getProductToolUiOverrides({
			serverName: '',
			toolName: 'ReadMcpResourceTool',
		})

		expect(
			listOverrides.renderToolUseMessage?.(
				{server: 'filesystem'},
				{verbose: false},
			),
		).toBe('List MCP resources from server "filesystem"')
		expect(listOverrides.userFacingName?.()).toBe('listMcpResources')
		expect(listOverrides.isResultTruncated?.('a\nb\nc\nd')).toBe(true)
		expect(
			readOverrides.renderToolUseMessage?.(
				{server: 'filesystem', uri: 'file:///tmp/a.txt'},
				{verbose: false},
			),
		).toBe('Read resource "file:///tmp/a.txt" from server "filesystem"')
		expect(readOverrides.userFacingName?.()).toBe('readMcpResource')
	})

	test('can apply product UI overrides to built-in resource tool objects', () => {
		const tool = applyProductToolUiOverrides({
			name: 'ReadMcpResourceTool',
			call: () => 'runtime behavior',
		})

		expect(tool.name).toBe('ReadMcpResourceTool')
		expect(tool.call()).toBe('runtime behavior')
		expect(tool.userFacingName?.()).toBe('readMcpResource')
		expect(
			tool.renderToolUseMessage?.(
				{server: 'filesystem', uri: 'file:///tmp/a.txt'},
				{verbose: false},
			),
		).toBe('Read resource "file:///tmp/a.txt" from server "filesystem"')
	})

	test('returns default MCP UI overrides for unmatched servers', () => {
		const overrides = getProductToolUiOverrides({
			serverName: 'generic-server',
			toolName: 'navigate',
			configType: 'stdio',
		})

		expect(overrides.renderToolUseMessage?.({}, {verbose: false})).toBe(
			'default-use',
		)
		expect(overrides.renderToolUseProgressMessage?.([], {verbose: false})).toBe(
			'default-progress',
		)
		expect(overrides.renderToolResultMessage?.('', [], {verbose: false})).toBe(
			'default-result',
		)
		expect(overrides.isResultTruncated?.('a\nb\nc\nd')).toBe(true)
		expect(defaultRendererLoaded).toBe(true)
		expect(chromeRendererLoaded).toBe(false)
	})

	test('merges Chrome MCP overrides over default MCP UI overrides', () => {
		const overrides = getProductToolUiOverrides({
			serverName: 'claude-in-chrome',
			toolName: 'navigate',
			configType: 'stdio',
		})

		expect(overrides.userFacingName?.()).toBe('Chrome[navigate]')
		expect(overrides.renderToolUseMessage?.({}, {verbose: false})).toBe(
			'default-use',
		)
		expect(chromeRendererLoaded).toBe(true)
	})

	test('returns product UI overrides for built-in tools without MCP defaults', () => {
		defaultRendererLoaded = false
		const overrides = getProductToolUiOverrides({
			toolName: 'WebSearch',
		})

		expect(overrides.userFacingName?.()).toBe('Web Search')
		expect(
			overrides.renderToolUseMessage?.({query: 'neptune engine'}, {verbose: false}),
		).toBe('"neptune engine"')
		expect(overrides.renderToolResultMessage).toBeFunction()
		expect(defaultRendererLoaded).toBe(false)
	})

	test('does not attach MCP default UI to unrelated built-in tools', () => {
		defaultRendererLoaded = false
		const overrides = getProductToolUiOverrides({
			toolName: 'Bash',
		})

		expect(overrides).toEqual({})
		expect(defaultRendererLoaded).toBe(false)
	})

	test('keeps tool identity when there are no product UI overrides', () => {
		const tool = {
			name: 'Bash',
			call: () => 'runtime behavior',
		}

		expect(applyProductToolUiOverrides(tool)).toBe(tool)
	})
})
