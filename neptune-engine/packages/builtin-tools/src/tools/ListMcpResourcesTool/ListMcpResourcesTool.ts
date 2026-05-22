import {z} from 'zod/v4'
import {buildTool, type ToolDef} from '../../tool.js'
import {jsonStringify} from '../../utils/json.js'
import {lazySchema} from '../../utils/lazySchema.js'
import {getMcpResourceRuntime} from '../MCPResourceRuntime.js'
import {DESCRIPTION, LIST_MCP_RESOURCES_TOOL_NAME, PROMPT} from './prompt.js'

const inputSchema = lazySchema(() =>
	z.object({
		server: z
			.string()
			.optional()
			.describe('Optional server name to filter resources by'),
	}),
)
type InputSchema = ReturnType<typeof inputSchema>

const outputSchema = lazySchema(() =>
	z.array(
		z.object({
			uri: z.string().describe('Resource URI'),
			name: z.string().describe('Resource name'),
			mimeType: z.string().optional().describe('MIME type of the resource'),
			description: z.string().optional().describe('Resource description'),
			server: z.string().describe('Server that provides this resource'),
		}),
	),
)
type OutputSchema = ReturnType<typeof outputSchema>

export type Output = z.infer<OutputSchema>

export const ListMcpResourcesTool = buildTool({
	isConcurrencySafe() {
		return true
	},
	isReadOnly() {
		return true
	},
	toAutoClassifierInput(input) {
		return input.server ?? ''
	},
	shouldDefer: true,
	name: LIST_MCP_RESOURCES_TOOL_NAME,
	searchHint: 'list resources from connected MCP servers',
	maxResultSizeChars: 100_000,
	async description() {
		return DESCRIPTION
	},
	async prompt() {
		return PROMPT
	},
	get inputSchema(): InputSchema {
		return inputSchema()
	},
	get outputSchema(): OutputSchema {
		return outputSchema()
	},
	async call(input, {options}) {
		const {server: targetServer} = input
		const runtime = getMcpResourceRuntime(options ?? {})

		return {
			data: await runtime.listResources({server: targetServer}),
		}
	},
	mapToolResultToToolResultBlockParam(content, toolUseID) {
		if (!content || content.length === 0) {
			return {
				tool_use_id: toolUseID,
				type: 'tool_result',
				content:
					'No resources found. MCP servers may still provide tools even if they have no resources.',
			}
		}
		return {
			tool_use_id: toolUseID,
			type: 'tool_result',
			content: jsonStringify(content),
		}
	},
} satisfies ToolDef<InputSchema, Output>)
