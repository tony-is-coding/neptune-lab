/**
 * AgentTool name constants — substrate stub for Stage B0.
 *
 * 设计目的：
 * - 让 substrate 内其他工具（REPLTool / GrepTool / SkillTool）按名字常量
 *   引用 AgentTool，不再断链到 product/cc-tools/AgentTool/。
 * - AgentTool 主体（ToolDef + run loop）由 Stage B2 在本目录补齐 ~2700 行薄壳。
 *
 * 与 cc 行为对齐：
 * - 'Agent' 是模型可见的工具名（不要改）
 * - 'Task' 是 cc 历史名，cc 6+ 仍把 'Task' 列为 LEGACY_AGENT_TOOL_NAME 接受
 * - 'Explore' / 'Plan' 是 cc 内置 one-shot agent，回填 tool_result 时跳过 usage
 *   trailer（substrate 内置 4 agents 中包含这两个，B3 会注册到 AgentRegistry）
 */

export const AGENT_TOOL_NAME = 'Agent'

/** Legacy wire name for backward compat (permission rules, hooks, resumed sessions). */
export const LEGACY_AGENT_TOOL_NAME = 'Task'

export const VERIFICATION_AGENT_TYPE = 'verification'

/**
 * Built-in agents that run once and return a report — the parent never
 * SendMessages back to continue them. Skip the agentId/SendMessage/usage
 * trailer for these to save tokens.
 */
export const ONE_SHOT_BUILTIN_AGENT_TYPES: ReadonlySet<string> = new Set([
	'Explore',
	'Plan',
])
