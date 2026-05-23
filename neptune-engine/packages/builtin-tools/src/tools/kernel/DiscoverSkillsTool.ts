import {z} from 'zod/v4'

import type {ToolDef} from '../../tool.js'
import {buildTool} from '../../tool.js'
import type {KernelToolContext} from '../../kernel-context.js'
import {requireProtocol} from '../../kernel-context.js'
import {lazySchema} from '../../utils/lazySchema.js'

export const DISCOVER_SKILLS_TOOL_NAME = 'DiscoverSkills'

const inputSchema = lazySchema(() =>
	z.strictObject({
		query: z
			.string()
			.optional()
			.describe('Optional capability keyword filter (matches name + description).'),
	}),
)
type InputSchema = ReturnType<typeof inputSchema>

interface SkillSummary {
	name: string
	description: string
	tools?: readonly string[]
	model?: string
}

export const DiscoverSkillsTool = buildTool({
	name: DISCOVER_SKILLS_TOOL_NAME,
	searchHint: 'list available skills declarative subagent templates',
	maxResultSizeChars: 32_000,
	get inputSchema(): InputSchema {
		return inputSchema()
	},
	async description() {
		return 'List available skills (declarative sub-agent templates) registered in this session.'
	},
	async prompt() {
		return [
			'Use DiscoverSkills to enumerate skills (Markdown declared sub-agent templates)',
			'currently loaded into the session. Filter by an optional capability keyword.',
			'Each result is a SkillSummary you can then invoke via the Skill tool.',
		].join('\n')
	},
	isReadOnly() {
		return true
	},
	isConcurrencySafe() {
		return true
	},
	async checkPermissions(input) {
		return {behavior: 'allow' as const, updatedInput: input}
	},
	async call(input, context): Promise<{data: SkillSummary[]}> {
		const registry = requireProtocol(context as KernelToolContext, 'skillRegistry')
		const all = registry.list()
		const q = input.query?.trim().toLowerCase()
		const filtered = q
			? all.filter(
					m =>
						m.name.toLowerCase().includes(q) ||
						m.description.toLowerCase().includes(q),
				)
			: all
		const summaries = filtered.map<SkillSummary>(m => ({
			name: m.name,
			description: m.description,
			...(m.tools !== undefined && {tools: m.tools}),
			...(m.model !== undefined && {model: m.model}),
		}))
		return {data: summaries}
	},
	mapToolResultToToolResultBlockParam(result, toolUseID) {
		return {
			tool_use_id: toolUseID,
			type: 'tool_result',
			content: JSON.stringify(result),
		}
	},
} satisfies ToolDef<InputSchema, SkillSummary[]>)
