/**
 * resultMapping — 把 SubAgentRunResult / async launch result 转 ToolResultBlock
 *
 * 设计目的（Stage B2.4）：
 * - cc resultMapping.ts 122 行的核心 ~70 行（含 usage trailer / 空内容 fallback / one-shot 跳过）
 * - 三类结果 → 三种 ToolResultBlock 形态
 *
 * 与 cc 行为对齐：
 * - completed + 非 one-shot agent → 含 usage trailer（agentId / total_tokens / tool_uses / duration_ms）
 * - completed + one-shot agent (Explore/Plan) → 跳过 trailer（节省 token）
 * - 空内容 → '(Subagent completed but returned no output.)' marker
 * - async_launched → 'Async agent launched.\nagentId: xxx\nrunId: xxx\noutputFile: xxx'
 */

import type {ToolResultBlockParam} from '../../tool.js'
import {ONE_SHOT_BUILTIN_AGENT_TYPES} from './constants.js'
import type {AsyncLaunchedOutput, CompletedOutput, Output} from './outputSchema.js'

type ResultContent = NonNullable<ToolResultBlockParam['content']>
type ContentBlock = Exclude<ResultContent, string>[number]

function textBlock(text: string): ContentBlock {
	return {type: 'text', text} as ContentBlock
}

export function mapAgentToolResultToBlock(
	output: Output,
	toolUseID: string,
): ToolResultBlockParam {
	if ((output as AsyncLaunchedOutput).status === 'async_launched') {
		const data = output as AsyncLaunchedOutput
		const taskLine = data.taskId ? `\ntaskId: ${data.taskId}` : ''
		return {
			tool_use_id: toolUseID,
			type: 'tool_result',
			content: [
				textBlock(
					`Async agent launched.\nagentId: ${data.agentId}\nrunId: ${data.runId}${taskLine}`,
				),
			] as ResultContent,
		}
	}

	const data = output as CompletedOutput
	const content: ContentBlock[] =
		data.content.length > 0
			? data.content.map(c => textBlock(c.text))
			: [textBlock('(Subagent completed but returned no output.)')]

	// One-shot built-in agents (Explore / Plan) 不需要 SendMessage 提示 — 跳过 trailer
	if (data.agentType && ONE_SHOT_BUILTIN_AGENT_TYPES.has(data.agentType)) {
		return {
			tool_use_id: toolUseID,
			type: 'tool_result',
			content: content as ResultContent,
		}
	}

	// 普通 sub-agent: 附 usage trailer
	const trailer = textBlock(
		`agentId: ${data.agentId}
<usage>total_tokens: ${data.totalTokens}
tool_uses: ${data.totalToolUseCount}
duration_ms: ${data.totalDurationMs}</usage>`,
	)
	return {
		tool_use_id: toolUseID,
		type: 'tool_result',
		content: [...content, trailer] as ResultContent,
	}
}
