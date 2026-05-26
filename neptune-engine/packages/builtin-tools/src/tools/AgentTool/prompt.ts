/**
 * AgentTool prompt — 给 LLM 看的工具说明（与 cc 行为对齐 + 简化）
 *
 * 设计目的（Stage B2.2）：
 * - 教 LLM 何时用 / 何时不用 / 怎么写好 prompt
 * - 列出 substrate 当前 AgentRegistry 内的可用 agent types
 * - 剥 cc 业务装饰：forkEnabled / coordinatorMode / agent_listing_delta attachment
 *
 * 与 cc 行为对齐（cc prompt.ts 等价）：
 * - 包含 "When NOT to use" 反例（FileRead / Glob / Grep 比 spawn 快的场景）
 * - 包含 "Writing the prompt" 教学（never delegate understanding）
 * - 列出可用 agent types + 每个 agent 可用工具清单
 */

import type {AgentManifest} from '@neptune/engine'
import {AGENT_TOOL_NAME} from './constants.js'

const WHEN_NOT_TO_USE = `
When NOT to use the ${AGENT_TOOL_NAME} tool:
- If you want to read a specific file path, use FileRead or Glob instead — faster than spawning an agent
- If you are searching for a specific class definition like "class Foo", use Grep instead
- If you are searching for code within a specific file or set of 2-3 files, use FileRead instead
- Other tasks that are not related to the agent descriptions above`

const WRITING_THE_PROMPT = `
## Writing the prompt

When spawning an agent with a \`subagent_type\`, it starts with zero context. Brief the agent like a smart colleague who just walked into the room — it hasn't seen this conversation, doesn't know what you've tried, doesn't understand why this task matters.

- Explain what you're trying to accomplish and why.
- Describe what you've already learned or ruled out.
- Give enough context about the surrounding problem that the agent can make judgment calls rather than just following a narrow instruction.
- If you need a short response, say so ("report in under 200 words").
- Lookups: hand over the exact command. Investigations: hand over the question — prescribed steps become dead weight when the premise is wrong.

Terse command-style prompts produce shallow, generic work.

**Never delegate understanding.** Don't write "based on your findings, fix the bug" or "based on the research, implement it." Those phrases push synthesis onto the agent instead of doing it yourself. Write prompts that prove you understood: include file paths, line numbers, what specifically to change.`

const USAGE_NOTES = `
Usage notes:
- Always include a short description (3-5 words) summarizing what the agent will do.
- When the agent is done, it will return a single message back to you. The result returned by the agent is not visible to the user. To show the user the result, you should send a text message back to the user with a concise summary of the result.
- The agent's outputs should generally be trusted.
- Clearly tell the agent whether you expect it to write code or just to do research (search, file reads, web fetches, etc.), since it is not aware of the user's intent.`

const EXAMPLE = `
Example usage:

<example_agent_descriptions>
"test-runner": use this agent after you are done writing code to run tests
"greeting-responder": use this agent to respond to user greetings with a friendly joke
</example_agent_descriptions>

<example>
user: "Please write a function that checks if a number is prime"
assistant: I'm going to use FileWrite to write the following code:
<code>
function isPrime(n) { /* ... */ }
</code>
<commentary>
Since a significant piece of code was written and the task was completed, now use the test-runner agent to run the tests
</commentary>
assistant: Uses the ${AGENT_TOOL_NAME} tool to launch the test-runner agent
</example>`

/** Format one agent line for the agent listing inside the prompt. */
export function formatAgentLine(agent: AgentManifest): string {
	const tools = agent.tools
		? agent.tools.length === 0
			? 'None'
			: agent.tools.join(', ')
		: 'All tools'
	return `- ${agent.type}: ${agent.description} (Tools: ${tools})`
}

export function getPrompt(agents: readonly AgentManifest[]): string {
	const agentListSection =
		agents.length > 0
			? `Available agent types and the tools they have access to:\n${agents
					.map(a => formatAgentLine(a))
					.join('\n')}`
			: `No specialized agent types are registered. The general-purpose agent is used by default.`

	return `Launch a new agent to handle complex, multi-step tasks autonomously.

The ${AGENT_TOOL_NAME} tool launches specialized agents (subprocesses) that autonomously handle complex tasks. Each agent type has specific capabilities and tools available to it.

${agentListSection}

When using the ${AGENT_TOOL_NAME} tool, specify a subagent_type parameter to select which agent type to use. If omitted, the general-purpose agent is used.

${WHEN_NOT_TO_USE}

${USAGE_NOTES}
${WRITING_THE_PROMPT}

${EXAMPLE}`
}
