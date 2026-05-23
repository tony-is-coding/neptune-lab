import {existsSync, readFileSync, writeFileSync} from 'fs'
import {dirname} from 'path'
import {mkdirSync} from 'fs'
import {buildTool, type Tool, type Tools} from '../types/tool.js'
import type {ToolRegistry, ToolSet} from '../types/tool.js'
import type {ToolPermissionContext} from '../types/permissions.js'

const anyObjectInputSchema = {
	type: 'object',
	additionalProperties: true,
}

function strictObjectInputSchema(properties: Record<string, unknown>) {
	return {
		type: 'object',
		properties,
		required: Object.keys(properties),
		additionalProperties: false,
	}
}

function stringifyResult(data: unknown): string {
	if (typeof data === 'string') return data
	return JSON.stringify(data, null, 2)
}

function mapResult(data: unknown, toolUseID: string) {
	return {
		type: 'tool_result' as const,
		tool_use_id: toolUseID,
		content: stringifyResult(data),
	}
}

function createTextTool(name: string, description: string): Tool {
	return buildTool({
		name,
		maxResultSizeChars: 100_000,
		strict: true,
		inputSchema: anyObjectInputSchema,
		async description() {
			return description
		},
		async prompt() {
			return description
		},
		renderToolUseMessage() {
			return null
		},
		mapToolResultToToolResultBlockParam: mapResult,
		async call(input: Record<string, unknown>) {
			return {
				data: {
					ok: true,
					tool: name,
					input,
				},
				resultForAssistant: `${name} completed.`,
			}
		},
	}) as Tool
}

const ReadTool = buildTool({
	name: 'Read',
	maxResultSizeChars: Infinity,
	strict: true,
	inputSchema: strictObjectInputSchema({
		file_path: {type: 'string'},
	}),
	async description() {
		return 'Read a file from the workspace.'
	},
	async prompt() {
		return 'Read a file from the workspace.'
	},
	isReadOnly() {
		return true
	},
	isConcurrencySafe() {
		return true
	},
	renderToolUseMessage() {
		return null
	},
	mapToolResultToToolResultBlockParam: mapResult,
	async call(input: {file_path: string}) {
		const content = readFileSync(input.file_path, 'utf-8')
		return {
			data: {content, file_path: input.file_path},
			resultForAssistant: content,
		}
	},
}) as Tool

const WriteTool = buildTool({
	name: 'Write',
	maxResultSizeChars: 100_000,
	strict: true,
	inputSchema: strictObjectInputSchema({
		file_path: {type: 'string'},
		content: {type: 'string'},
	}),
	async description() {
		return 'Write a file in the workspace.'
	},
	async prompt() {
		return 'Write a file in the workspace.'
	},
	renderToolUseMessage() {
		return null
	},
	mapToolResultToToolResultBlockParam: mapResult,
	async call(input: {file_path: string; content: string}) {
		const existed = existsSync(input.file_path)
		mkdirSync(dirname(input.file_path), {recursive: true})
		writeFileSync(input.file_path, input.content, 'utf-8')
		return {
			data: {
				type: existed ? 'update' : 'create',
				filePath: input.file_path,
				content: input.content,
			},
			resultForAssistant: `Wrote ${input.file_path}`,
		}
	},
}) as Tool

/**
 * Server/headless ToolRegistry Adapter.
 *
 * It intentionally avoids importing builtin tool modules, because many of
 * those modules still import UI renderers at module load time.
 */
export class HeadlessToolRegistry implements ToolRegistry {
	private readonly toolSets: ToolSet[] = []
	private cache: Tools | null = null

	registerToolSet(toolSet: ToolSet): void {
		this.toolSets.push(toolSet)
		this.cache = null
	}

	getTools(_permissionContext: ToolPermissionContext): Tool[] {
		if (this.cache) return [...this.cache]

		const tools: Tool[] = [
			ReadTool,
			WriteTool,
			createTextTool('Edit', 'Edit a file in the workspace.'),
			createTextTool('Grep', 'Search file contents in the workspace.'),
			createTextTool('Glob', 'Find files by glob pattern in the workspace.'),
			createTextTool('TaskCreate', 'Create a plan task.'),
			createTextTool('TaskGet', 'Read a plan task.'),
			createTextTool('TaskUpdate', 'Update a plan task.'),
			createTextTool('TaskList', 'List plan tasks.'),
			createTextTool('TodoWrite', 'Update the current todo list.'),
		]

		for (const toolSet of this.toolSets) {
			if (toolSet.enabled !== false) {
				tools.push(...toolSet.tools)
			}
		}

		this.cache = tools.filter(tool => {
			const isEnabled = tool.isEnabled
			return typeof isEnabled === 'function' ? isEnabled() : true
		})
		return [...this.cache]
	}

	getToolByName(name: string): Tool | undefined {
		return this.getTools({} as ToolPermissionContext).find(tool => tool.name === name)
	}

	getTool(name: string): Tool | undefined {
		return this.getToolByName(name)
	}

	filterTools(filterFn: (tool: Tool) => boolean): Tool[] {
		return this.getTools({} as ToolPermissionContext).filter(filterFn)
	}

	getCoreToolCount(): number {
		return this.getTools({} as ToolPermissionContext).length
	}
}
