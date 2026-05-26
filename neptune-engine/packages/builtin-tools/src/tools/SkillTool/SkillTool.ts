/**
 * SkillTool — substrate skill 启动器（B6 薄壳）
 *
 * 设计目的（红线 #1 + #4 — skill 启动是 substrate 必备能力）：
 * - 让 LLM 通过 tool_use(Skill) 启动一个声明式 sub-agent（来自 SkillRegistry 的 manifest）
 * - 复用 B2 的 runSubAgent 核心（红线 #2 — 不重复实现状态机）
 * - cc SkillTool 1109 行复杂业务（slash-command / plugin / EXPERIMENTAL_SKILL_SEARCH）
 *   保留 product/cc-tools/SkillTool/ 作参考；substrate 内薄壳 ~200 行
 *
 * 流程：
 * 1. 校验 skill 已注册（ctx.kernel.skillRegistry.find）
 * 2. 把 SkillManifest 转成 ad-hoc AgentManifest（systemPrompt = skill.prompt）
 * 3. 复用 runSubAgent → AgentLoop.run
 * 4. result aggregate 走 SkillTool 自己的 outputSchema（completed 单形态）
 *
 * 与 AgentTool 区别：
 * - AgentTool: input 含 description/prompt/subagent_type → 按 type 查 AgentRegistry
 * - SkillTool: input 含 skill/args → 按 name 查 SkillRegistry，转 ad-hoc Agent
 */

import {z} from 'zod/v4'
import {randomUUID} from 'crypto'
import type {AgentManifest, StreamingProviderAdapter} from '@neptune/engine'
import {requireProtocol, type KernelToolContext} from '../../kernel-context.js'
import {buildTool, type ToolDef, type Tool, type ToolResultBlockParam} from '../../tool.js'
import {runSubAgent, extractPartialResult} from '../AgentTool/AgentTool.js'
import {SKILL_TOOL_NAME} from './constants.js'
import {inputSchema, type InputSchema, type SkillToolInput} from './inputSchema.js'
import {type Output} from './outputSchema.js'
import {getPrompt} from './prompt.js'

// ============================================================
// SkillTool ToolUseContext extension
// ============================================================

interface SkillToolKernelContext extends KernelToolContext {
	subAgentDepth?: number
	subAgentMaxDepth?: number
	provider?: StreamingProviderAdapter
}

const DEFAULT_SUB_AGENT_MAX_DEPTH = 3

// ============================================================
// 主体
// ============================================================

export const SkillTool = buildTool({
	name: SKILL_TOOL_NAME,
	searchHint: 'invoke a declarative skill (registered sub-agent template)',
	maxResultSizeChars: 100_000,

	get inputSchema(): InputSchema {
		return inputSchema()
	},

	// outputSchema 不挂 ToolDef（与 AgentTool 同样原因：避免 zod 类型签名不兼容）。
	// caller 可以手动 import {outputSchema} from './outputSchema.js' 校验。

	async description({skill}: SkillToolInput): Promise<string> {
		return `Invoke skill: ${skill}`
	},

	async prompt(): Promise<string> {
		// 注：caller 传 skills 上下文时由 AgentLoop 包装层处理；这里 fallback 空 list 提示
		return getPrompt([])
	},

	isReadOnly(): boolean {
		return false
	},

	async checkPermissions(input) {
		return {behavior: 'allow' as const, updatedInput: input}
	},

	async call(input: SkillToolInput, context, _canUseTool, _parentMessage) {
		const ctx = context as SkillToolKernelContext

		// 1. depth check（防递归 spawn）
		const depth = ctx.subAgentDepth ?? 0
		const maxDepth = ctx.subAgentMaxDepth ?? DEFAULT_SUB_AGENT_MAX_DEPTH
		if (depth >= maxDepth) {
			throw new Error(
				`Sub-agent depth limit reached (${depth} >= ${maxDepth}). ` +
					'Refusing to spawn another skill to prevent runaway recursion.',
			)
		}

		// 2. 解析 skill manifest
		const registry = requireProtocol(ctx, 'skillRegistry')
		const trimmed = input.skill.trim()
		const skillName = trimmed.startsWith('/') ? trimmed.substring(1) : trimmed
		const manifest = registry.find(skillName)
		if (!manifest) {
			const all = registry.list()
			const types = all.map(m => m.name).join(', ') || '(none registered)'
			throw new Error(
				`Skill '${skillName}' not found. Available skills: ${types}`,
			)
		}

		// 3. provider 注入
		const provider = ctx.provider
		if (!provider) {
			throw new Error(
				`SkillTool requires ctx.provider (StreamingProviderAdapter) to be injected. ` +
					'Host should set ctx.provider when creating ToolUseContext.',
			)
		}

		// 4. SkillManifest → ad-hoc AgentManifest（复用 runSubAgent 核心）
		const adHocAgentManifest: AgentManifest = {
			type: `skill:${manifest.name}`,
			name: manifest.name,
			description: manifest.description,
			systemPrompt: manifest.prompt,
			...(manifest.tools !== undefined && {tools: [...manifest.tools] as string[]}),
			...(manifest.model !== undefined && {modelHint: manifest.model}),
			metadata: {
				source: 'skill',
				skillName: manifest.name,
				...(manifest.metadata ?? {}),
			},
		}

		// 5. 解析 sub-agent tools（manifest.tools 白名单 + 排除 SkillTool / AgentTool 自身防递归）
		const parentTools = ((ctx.options as {tools?: Tool[]} | undefined)?.tools ?? []) as Tool[]
		const subTools = resolveSkillSubAgentTools(adHocAgentManifest, parentTools)

		// 6. model 三段优先级（与 AgentTool 一致）
		const parentModel = (ctx.options as {mainLoopModel?: string} | undefined)?.mainLoopModel
		const model = resolveModelForSkill(adHocAgentManifest, parentModel)

		// 7. 跑 sub-agent
		const agentId = randomUUID()
		const startTime = Date.now()
		const parentSignal = (ctx.abortController as AbortController | undefined)?.signal

		const subAgentContext: SkillToolKernelContext = {
			...ctx,
			subAgentDepth: depth + 1,
			subAgentMaxDepth: maxDepth,
		}

		const args = input.args ?? ''
		const subResult = await runSubAgent({
			manifest: adHocAgentManifest,
			prompt: args,
			model,
			provider,
			parentSignal,
			tools: subTools,
			parentContext: subAgentContext as unknown as Parameters<typeof runSubAgent>[0]['parentContext'],
			agentId,
			startTime,
		})

		// 8. 错误处理
		if (subResult.error || subResult.reason === 'aborted') {
			const partial = extractPartialResult(subResult.messages)
			const partialNote = partial ? `\n\nPartial output:\n${partial}` : ''
			const errMsg = subResult.error
				? `Skill '${manifest.name}' failed: ${subResult.error.message}`
				: `Skill '${manifest.name}' was aborted.`
			throw new Error(`${errMsg}${partialNote}`)
		}

		// 9. completed result
		const totalTokens =
			subResult.usage.input_tokens +
			subResult.usage.output_tokens +
			subResult.usage.cache_creation_input_tokens +
			subResult.usage.cache_read_input_tokens

		const completed: Output = {
			status: 'completed',
			success: true,
			skillName: manifest.name,
			agentId,
			content: subResult.content,
			totalToolUseCount: subResult.totalToolUseCount,
			totalDurationMs: subResult.totalDurationMs,
			totalTokens,
			...(args && {args}),
		}
		return {data: completed}
	},

	mapToolResultToToolResultBlockParam(result, toolUseID): ToolResultBlockParam {
		const data = result as Output
		const content =
			data.content.length > 0
				? data.content.map(c => ({type: 'text' as const, text: c.text}))
				: [
						{
							type: 'text' as const,
							text: '(Skill completed but returned no output.)',
						},
					]
		const trailer = {
			type: 'text' as const,
			text: `skill: ${data.skillName} | agentId: ${data.agentId}
<usage>total_tokens: ${data.totalTokens}
tool_uses: ${data.totalToolUseCount}
duration_ms: ${data.totalDurationMs}</usage>`,
		}
		type ContentArray = NonNullable<ToolResultBlockParam['content']>
		return {
			tool_use_id: toolUseID,
			type: 'tool_result',
			content: [...content, trailer] as unknown as ContentArray,
		}
	},
} satisfies ToolDef<InputSchema, Output>)

// ============================================================
// 辅助
// ============================================================

function resolveSkillSubAgentTools(
	manifest: AgentManifest,
	parentTools: readonly Tool[],
): Tool[] {
	const wildcardOrUndefined =
		manifest.tools === undefined ||
		(manifest.tools.length === 1 && manifest.tools[0] === '*')

	const filtered = wildcardOrUndefined
		? [...parentTools]
		: parentTools.filter(t => manifest.tools!.includes(t.name))

	// 排除 SkillTool / AgentTool / Task（默认行为：skill 不递归 spawn 其他 sub-agent）
	return filtered.filter(
		t => t.name !== SKILL_TOOL_NAME && t.name !== 'Agent' && t.name !== 'Task',
	)
}

function resolveModelForSkill(
	manifest: AgentManifest,
	parentModel: string | undefined,
): string {
	const hint = manifest.modelHint
	if (hint && hint !== 'inherit') return hint
	if (parentModel) return parentModel
	return 'claude-sonnet-4-20250514'
}

// 公开 helpers（B5/B6 内 SkillTool / SendMessageTool 等可复用）
export {SKILL_TOOL_NAME} from './constants.js'
export type {SkillToolInput, InputSchema} from './inputSchema.js'
export type {Output, OutputSchema} from './outputSchema.js'
export {getPrompt as getSkillToolPrompt} from './prompt.js'
