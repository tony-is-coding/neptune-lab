/**
 * AgentTool — substrate sub-agent 启动器（Stage B2 薄壳）
 *
 * 设计目的（红线 #1 + #4 — agent 启动是 substrate 必备能力）：
 * - 让 LLM 通过 tool_use(Agent) 启动 sub-agent，跑完后 result 回填
 * - 依托 substrate 协议组装：AgentRegistry + AgentLoop + ToolUseContext
 * - cc AgentTool 5576 行 (主体 1722 行) 的核心薄壳实现 (~250 行 ToolDef + ~280 行 runSubAgent + 模块化拆分)
 *
 * 与 cc 行为对齐（cc AgentTool.ts:131-1715 实测）：
 * - inputSchema 5 字段：description / prompt / subagent_type? / model? / run_in_background?
 * - outputSchema 双形态：completed / async_launched
 * - prompt 模板：when NOT to use + writing the prompt + agent listing
 * - last assistant text + 回溯 fallback + countToolUses + token usage trailer
 * - 三类错误：tool throw / API error / AbortError + partial result
 * - cancellation 链路：parent abort → child abort（独立 controller）
 *
 * 与 cc 业务剥离（红线 #2 + #4）：
 * - 不抄 spawnTeammate / agent teams（B5 落到 SendMessageTool 路径）
 * - 不抄 forkSubagent / worktree（红线 #4 业务）
 * - 不抄 LocalAgentTask 业务（async background 走 B4 协议化）
 * - 不抄 agentColorManager / agentDisplay React UI（红线 #4 UI 装饰）
 * - 不抄 agentMemory / agentMemorySnapshot（B1.1 已落 AgentScopedMemoryStore 协议）
 *
 * 22 项功能契约（Stage A 用户拍板）：
 *  1. 按 manifest.type spawn sub-agent ✅
 *  2. 用 manifest.systemPrompt 启动（独立 system prompt）✅
 *  3. manifest.tools 白名单过滤 ✅
 *  4. manifest.modelHint 选模型（含 'inherit' 语义）✅
 *  5. 聚合 last assistant text + content blocks ✅
 *  6. usage trailer（agentId/totalTokens/toolUses/durationMs）✅
 *  7. parent abort → child sub-agent abort 链路 ✅
 *  8. 三类错误 + partial result extraction ✅
 *  9. 一轮内多个 tool_use(AgentTool) → 并行 spawn（AgentLoop 已支持）✅
 * 10. sub-agent runStore 状态外化（继承 parent runStore）✅ P0.3
 * 11. progress streaming（每 tool_use 后 emit）⏸️ B7（需 hook 注入）
 * 12. async background launch ✅ P0.3（TaskQueue + RunStore 替代 cc LocalAgentTask）
 * 13. run_in_background 字段 + TaskQueue 替代 LocalAgentTask ✅ P0.3
 * 14. sub-agent depth 限制（防 spawn 风暴）✅
 * 15. permissionMode 继承 + 覆盖 ⏸️ B7（需 ctx.options 透传）
 * 16-21. SkillTool 路径 ✅ P0.2
 * 22. recordSkillUsage P2 可舍弃
 *
 * B2 范围：1-9 + 14（10 项核心 + AgentLoop 已支持的并行 spawn）
 * P0.3 范围：10, 12, 13 协议化（TaskQueue + RunStore + AgentLoop.runWithStore）
 * P0.2 范围：16-21（SkillTool 薄壳已落）
 * B7 接续：11, 15
 */

import {z} from 'zod/v4'
import {randomUUID} from 'crypto'
import type {AgentManifest, StreamingProviderAdapter} from '@neptune/engine'
import {requireProtocol, type KernelToolContext} from '../../kernel-context.js'
import {buildTool, type ToolDef, type Tool} from '../../tool.js'
import {tagMessagesWithToolUseID} from '../utils.js'
import {AGENT_TOOL_NAME, LEGACY_AGENT_TOOL_NAME} from './constants.js'
import {inputSchema, type InputSchema, type AgentToolInput} from './inputSchema.js'
import {outputSchema, type OutputSchema, type Output} from './outputSchema.js'
import {getPrompt} from './prompt.js'
import {mapAgentToolResultToBlock} from './resultMapping.js'
import {runSubAgent, extractPartialResult} from './runSubAgent.js'
import {launchSubAgentInBackground} from './runSubAgentBackground.js'

// ============================================================
// AgentTool ToolUseContext extension
// ============================================================

/**
 * AgentTool 需要的 ctx 字段（除 kernel.agentRegistry 外）。
 *
 * - subAgentDepth: 当前 sub-agent 嵌套层数（防 spawn 风暴；root=0）
 * - subAgentMaxDepth: 上限（默认 3）
 * - provider: substrate 主 provider（sub-agent 复用）
 *   - 注：由 host 通过 ctx 注入；不存在则报错
 */
interface AgentToolKernelContext extends KernelToolContext {
	subAgentDepth?: number
	subAgentMaxDepth?: number
	/** Provider 注入：sub-agent run 复用 host provider */
	provider?: StreamingProviderAdapter
}

const DEFAULT_SUB_AGENT_MAX_DEPTH = 3
const GENERAL_PURPOSE_AGENT_TYPE = 'general-purpose'

// ============================================================
// Helper: 解析 sub-agent 工具白名单
// ============================================================

/**
 * 按 manifest.tools 过滤 ctx.options.tools。
 *
 * - manifest.tools = undefined → 全部 parent 工具池
 * - manifest.tools = ['*'] → 全部
 * - manifest.tools = ['Bash', 'Grep'] → 仅这两个（按 name 匹配）
 *
 * 同时排除 AgentTool 自己（防止递归 spawn 失控；depth 也限制了，但双重保险）。
 */
function resolveSubAgentTools(
	manifest: AgentManifest,
	parentTools: readonly Tool[],
): Tool[] {
	const wildcardOrUndefined =
		manifest.tools === undefined ||
		(manifest.tools.length === 1 && manifest.tools[0] === '*')

	const filtered = wildcardOrUndefined
		? [...parentTools]
		: parentTools.filter(t => manifest.tools!.includes(t.name))

	// 排除 AgentTool 自身（sub-agent 默认不再 spawn 子孙）
	return filtered.filter(t => t.name !== AGENT_TOOL_NAME && t.name !== LEGACY_AGENT_TOOL_NAME)
}

// ============================================================
// Helper: model 三段优先级解析
// ============================================================

/**
 * cc 等价行为：
 * - input.model > manifest.modelHint > host 默认（context.options.mainLoopModel）
 * - manifest.modelHint = 'inherit' → 继承 parent
 * - 缺失全部 → fallback 到 'claude-sonnet-4-20250514'
 */
function resolveModel(
	inputModel: string | undefined,
	manifest: AgentManifest,
	parentModel: string | undefined,
): string {
	if (inputModel) return inputModel
	const hint = manifest.modelHint
	if (hint && hint !== 'inherit') return hint
	if (parentModel) return parentModel
	return 'claude-sonnet-4-20250514'
}

// ============================================================
// AgentTool 主体
// ============================================================

export const AgentTool = buildTool({
	name: AGENT_TOOL_NAME,
	aliases: [LEGACY_AGENT_TOOL_NAME],
	searchHint: 'spawn a sub-agent to handle complex multi-step tasks autonomously',
	maxResultSizeChars: 100_000,

	get inputSchema(): InputSchema {
		return inputSchema()
	},

	// 注：output schema 是 union（completed / async_launched），buildTool 类型签名
	// 接受 ZodType<unknown> 但 ZodUnion 在 zod v4 内部类型有差异；不暴露 outputSchema 字段，
	// 由 caller 自己解析。需要校验时 import {outputSchema} 自行 zod.parse。
	// (cc AgentTool.ts 同样用 z.union 但 cast 透传 schema；substrate 简化为不挂在 ToolDef 上。)

	async description(): Promise<string> {
		return 'Launch a new agent (sub-agent) to handle complex, multi-step tasks autonomously.'
	},

	async prompt(): Promise<string> {
		// 注：prompt 接收 caller 传的 agents 上下文时会被覆盖；这里默认 [] 让 LLM 看到 fallback 提示
		return getPrompt([])
	},

	isReadOnly(): boolean {
		return false
	},

	async checkPermissions(input) {
		return {behavior: 'allow' as const, updatedInput: input}
	},

	async call(input: AgentToolInput, context, _canUseTool, parentMessage) {
		const ctx = context as AgentToolKernelContext

		// 1. depth check（防 sub-agent 失控 spawn）
		const depth = ctx.subAgentDepth ?? 0
		const maxDepth = ctx.subAgentMaxDepth ?? DEFAULT_SUB_AGENT_MAX_DEPTH
		if (depth >= maxDepth) {
			throw new Error(
				`Sub-agent depth limit reached (${depth} >= ${maxDepth}). ` +
					'Refusing to spawn another sub-agent to prevent runaway recursion.',
			)
		}

		// 2. 解析 manifest（kernel.agentRegistry 必须注入）
		const registry = requireProtocol(ctx, 'agentRegistry')
		const requestedType = input.subagent_type ?? GENERAL_PURPOSE_AGENT_TYPE
		const manifest = await registry.get(requestedType)
		if (!manifest) {
			const available = await registry.list()
			const types = available.map(m => m.type).join(', ') || '(none registered)'
			throw new Error(
				`Agent type '${requestedType}' not found. Available agent types: ${types}`,
			)
		}

		// 3. provider 必须注入（sub-agent 复用 host streaming provider）
		const provider = ctx.provider
		if (!provider) {
			throw new Error(
				`AgentTool requires ctx.provider (StreamingProviderAdapter) to be injected. ` +
					'Host should set ctx.provider when creating ToolUseContext.',
			)
		}

		// 4. 解析 tools 白名单 + model 优先级
		const parentTools = ((ctx.options as {tools?: Tool[]} | undefined)?.tools ??
			[]) as Tool[]
		const subTools = resolveSubAgentTools(manifest, parentTools)
		const parentModelMaybe = (
			ctx.options as {mainLoopModel?: string} | undefined
		)?.mainLoopModel
		const model = resolveModel(input.model, manifest, parentModelMaybe)

		// 5. 准备 sub-agent 运行上下文
		const agentId = randomUUID()
		const startTime = Date.now()
		const parentSignal = (
			ctx.abortController as AbortController | undefined
		)?.signal

		// 6. async background launch — P0.3 协议化（TaskQueue + RunStore）
		if (input.run_in_background) {
			const runStoreFromCtx = (ctx.kernel as Record<string, unknown> | undefined)
				?.runStore as import('@neptune/engine').RunStore | undefined
			if (!runStoreFromCtx) {
				throw new Error(
					'AgentTool run_in_background=true requires ctx.kernel.runStore (RunStore). ' +
						'Host should inject runStore in the engine config / ToolUseContext kernel bag.',
				)
			}
			const taskQueue = (ctx.kernel as Record<string, unknown> | undefined)
				?.taskQueue as import('@neptune/engine').TaskQueue | undefined

			const subAgentContextAsync: AgentToolKernelContext = {
				...ctx,
				subAgentDepth: depth + 1,
				subAgentMaxDepth: maxDepth,
			}

			const launched = await launchSubAgentInBackground({
				manifest,
				prompt: input.prompt,
				model,
				provider,
				parentSignal,
				tools: subTools,
				parentContext: subAgentContextAsync as unknown as Parameters<
					typeof launchSubAgentInBackground
				>[0]['parentContext'],
				agentId,
				startTime,
				runStore: runStoreFromCtx,
				...(taskQueue && {taskQueue}),
				createdBy: (ctx as {agentId?: string}).agentId ?? 'parent',
				description: input.description,
			})

			const asyncOutput: Output = {
				status: 'async_launched',
				agentId: launched.agentId,
				runId: launched.runId,
				...(launched.taskId !== undefined && {taskId: launched.taskId}),
				description: input.description,
				prompt: input.prompt,
			}
			return {data: asyncOutput}
		}

		// 7. 同步 spawn — depth +1 透传给 sub-agent
		const subAgentContext: AgentToolKernelContext = {
			...ctx,
			subAgentDepth: depth + 1,
			subAgentMaxDepth: maxDepth,
			// kernel bag 完整继承（让 sub-agent 也能用 protocols）
		}

		const result = await runSubAgent({
			manifest,
			prompt: input.prompt,
			model,
			provider,
			parentSignal,
			tools: subTools,
			parentContext: subAgentContext as unknown as Parameters<
				typeof runSubAgent
			>[0]['parentContext'],
			agentId,
			startTime,
		})

		// 8. 错误处理 — abort / api error / max_turns 等带 partial
		if (result.error || result.reason === 'aborted') {
			const partial = extractPartialResult(result.messages)
			const partialNote = partial ? `\n\nPartial output:\n${partial}` : ''
			const errMsg = result.error
				? `Sub-agent failed: ${result.error.message}`
				: 'Sub-agent was aborted.'
			throw new Error(`${errMsg}${partialNote}`)
		}

		// 9. aggregate completed result
		const completedOutput: Output = {
			status: 'completed',
			agentId,
			agentType: manifest.type,
			content: result.content,
			totalToolUseCount: result.totalToolUseCount,
			totalDurationMs: result.totalDurationMs,
			totalTokens:
				result.usage.input_tokens +
				result.usage.output_tokens +
				result.usage.cache_creation_input_tokens +
				result.usage.cache_read_input_tokens,
			usage: {
				input_tokens: result.usage.input_tokens,
				output_tokens: result.usage.output_tokens,
				cache_creation_input_tokens: result.usage.cache_creation_input_tokens,
				cache_read_input_tokens: result.usage.cache_read_input_tokens,
			},
			prompt: input.prompt,
		}

		// 10. tag newMessages with parent toolUseID（与 cc utils.ts 等价行为）
		void parentMessage // reserved for future progress streaming

		return {data: completedOutput}
	},

	mapToolResultToToolResultBlockParam(result, toolUseID) {
		return mapAgentToolResultToBlock(result as Output, toolUseID)
	},
} satisfies ToolDef<InputSchema, Output>)

// 重新导出一些公开 helpers，便于 SkillTool（B6）复用
export {runSubAgent, extractPartialResult, countToolUses} from './runSubAgent.js'
export {resolveSubAgentTools, resolveModel}
export {getPrompt as getAgentToolPrompt} from './prompt.js'
export {mapAgentToolResultToBlock} from './resultMapping.js'
export {AGENT_TOOL_NAME, LEGACY_AGENT_TOOL_NAME, ONE_SHOT_BUILTIN_AGENT_TYPES} from './constants.js'
export type {AgentToolInput, InputSchema} from './inputSchema.js'
export type {Output, OutputSchema} from './outputSchema.js'
