import {getFeatureValue_CACHED_MAY_BE_STALE} from '../../utils/cc-shim/analytics.js'
import {hasEmbeddedSearchTools} from '../../utils/featureFlags.js'
import {isEnvDefinedFalsy, isEnvTruthy} from '../../utils/env.js'
import {FILE_READ_TOOL_NAME} from '../FileReadTool/prompt.js'
import {FILE_WRITE_TOOL_NAME} from '../FileWriteTool/prompt.js'
import {GLOB_TOOL_NAME} from '../GlobTool/prompt.js'
import {AGENT_TOOL_NAME} from './constants.js'
import {isForkSubagentEnabled} from './forkSubagent.js'
import type {AgentDefinition} from './loadAgentsDir.js'

function getToolsDescription(agent: AgentDefinition): string {
	const {tools, disallowedTools} = agent
	const hasAllowlist = tools && tools.length > 0
	const hasDenylist = disallowedTools && disallowedTools.length > 0

	if (hasAllowlist && hasDenylist) {
		// Both defined: filter allowlist by denylist to match runtime behavior
		const denySet = new Set(disallowedTools)
		const effectiveTools = tools.filter(t => !denySet.has(t))
		if (effectiveTools.length === 0) {
			return 'None'
		}
		return effectiveTools.join(', ')
	} else if (hasAllowlist) {
		// Allowlist only: show the specific tools available
		return tools.join(', ')
	} else if (hasDenylist) {
		// Denylist only: show "All tools except X, Y, Z"
		return `All tools except ${disallowedTools.join(', ')}`
	}
	// No restrictions
	return 'All tools'
}

/**
 * Format one agent line for the agent_listing_delta attachment message:
 * `- type: whenToUse (Tools: ...)`.
 */
export function formatAgentLine(agent: AgentDefinition): string {
	const toolsDescription = getToolsDescription(agent)
	return `- ${agent.agentType}: ${agent.whenToUse} (Tools: ${toolsDescription})`
}

/**
 * Whether the agent list should be injected as an attachment message instead
 * of embedded in the tool description. When true, getPrompt() returns a static
 * description and attachments.ts emits an agent_listing_delta attachment.
 *
 * The dynamic agent list was ~10.2% of fleet cache_creation tokens: MCP async
 * connect, /reload-plugins, or permission-mode changes mutate the list →
 * description changes → full tool-schema cache bust.
 *
 * Override with CLAUDE_CODE_AGENT_LIST_IN_MESSAGES=true/false for testing.
 */
export function shouldInjectAgentListInMessages(): boolean {
	if (isEnvTruthy(process.env.CLAUDE_CODE_AGENT_LIST_IN_MESSAGES)) return true
	if (isEnvDefinedFalsy(process.env.CLAUDE_CODE_AGENT_LIST_IN_MESSAGES))
		return false
	return getFeatureValue_CACHED_MAY_BE_STALE('tengu_agent_list_attach', false)
}

export async function getPrompt(
	agentDefinitions: AgentDefinition[],
	isCoordinator?: boolean,
	allowedAgentTypes?: string[],
): Promise<string> {
	// Filter agents by allowed types when Agent(x,y) restricts which agents can be spawned
	const effectiveAgents = allowedAgentTypes
		? agentDefinitions.filter(a => allowedAgentTypes.includes(a.agentType))
		: agentDefinitions

	// Fork execution remains in the runtime tool; product-specific fork usage
	// coaching is appended by the product Agent delivery wrapper.
	const forkEnabled = isForkSubagentEnabled()

	const writingThePromptSection = `

## Writing the prompt

When spawning an agent with a \`subagent_type\`, it starts with zero context. Brief the agent like a smart colleague who just walked into the room — it hasn't seen this conversation, doesn't know what you've tried, doesn't understand why this task matters.
- Explain what you're trying to accomplish and why.
- Describe what you've already learned or ruled out.
- Give enough context about the surrounding problem that the agent can make judgment calls rather than just following a narrow instruction.
- If you need a short response, say so ("report in under 200 words").
- Lookups: hand over the exact command. Investigations: hand over the question — prescribed steps become dead weight when the premise is wrong.

Terse command-style prompts produce shallow, generic work.

**Never delegate understanding.** Don't write "based on your findings, fix the bug" or "based on the research, implement it." Those phrases push synthesis onto the agent instead of doing it yourself. Write prompts that prove you understood: include file paths, line numbers, what specifically to change.
`

	const currentExamples = `Example usage:

<example_agent_descriptions>
"test-runner": use this agent after you are done writing code to run tests
"greeting-responder": use this agent to respond to user greetings with a friendly joke
</example_agent_descriptions>

<example>
user: "Please write a function that checks if a number is prime"
assistant: I'm going to use the ${FILE_WRITE_TOOL_NAME} tool to write the following code:
<code>
function isPrime(n) {
  if (n <= 1) return false
  for (let i = 2; i * i <= n; i++) {
    if (n % i === 0) return false
  }
  return true
}
</code>
<commentary>
Since a significant piece of code was written and the task was completed, now use the test-runner agent to run the tests
</commentary>
assistant: Uses the ${AGENT_TOOL_NAME} tool to launch the test-runner agent
</example>

<example>
user: "Hello"
<commentary>
Since the user is greeting, use the greeting-responder agent to respond with a friendly joke
</commentary>
assistant: "I'm going to use the ${AGENT_TOOL_NAME} tool to launch the greeting-responder agent"
</example>
`

	// When the gate is on, the agent list lives in an agent_listing_delta
	// attachment (see attachments.ts) instead of inline here. This keeps the
	// tool description static across MCP/plugin/permission changes so the
	// tools-block prompt cache doesn't bust every time an agent loads.
	const listViaAttachment = shouldInjectAgentListInMessages()

	const agentListSection = listViaAttachment
		? `Available agent types are listed in <system-reminder> messages in the conversation.`
		: `Available agent types and the tools they have access to:
${effectiveAgents.map(agent => formatAgentLine(agent)).join('\n')}`

	// Shared core prompt used by both coordinator and non-coordinator modes
	const shared = `Launch a new agent to handle complex, multi-step tasks autonomously.

The ${AGENT_TOOL_NAME} tool launches specialized agents (subprocesses) that autonomously handle complex tasks. Each agent type has specific capabilities and tools available to it.

${agentListSection}

${
		forkEnabled
			? `When using the ${AGENT_TOOL_NAME} tool, specify a subagent_type to use a specialized agent. If omitted, the runtime will use the current session as the agent input.`
			: `When using the ${AGENT_TOOL_NAME} tool, specify a subagent_type parameter to select which agent type to use. If omitted, the general-purpose agent is used.`
	}`

	// Coordinator mode gets the slim prompt -- the coordinator system prompt
	// already covers usage notes, examples, and when-not-to-use guidance.
	if (isCoordinator) {
		return shared
	}

	// Ant-native builds alias find/grep to embedded bfs/ugrep and remove the
	// dedicated Glob/Grep tools, so point at find via Bash instead.
	const embedded = hasEmbeddedSearchTools()
	const fileSearchHint = embedded
		? '`find` via the Bash tool'
		: `the ${GLOB_TOOL_NAME} tool`
	// The "class Foo" example is about content search. Non-embedded stays Glob
	// (original intent: find-the-file-containing). Embedded gets grep because
	// find -name doesn't look at file contents.
	const contentSearchHint = embedded
		? '`grep` via the Bash tool'
		: `the ${GLOB_TOOL_NAME} tool`
	const whenNotToUseSection = `
When NOT to use the ${AGENT_TOOL_NAME} tool:
- If you want to read a specific file path, use the ${FILE_READ_TOOL_NAME} tool or ${fileSearchHint} instead of the ${AGENT_TOOL_NAME} tool, to find the match more quickly
- If you are searching for a specific class definition like "class Foo", use ${contentSearchHint} instead, to find the match more quickly
- If you are searching for code within a specific file or set of 2-3 files, use the ${FILE_READ_TOOL_NAME} tool instead of the ${AGENT_TOOL_NAME} tool, to find the match more quickly
- Other tasks that are not related to the agent descriptions above
`

	// Non-coordinator gets the full prompt with all sections
	return `${shared}
${whenNotToUseSection}

Usage notes:
- Always include a short description (3-5 words) summarizing what the agent will do.
- When the agent is done, it will return a single message back to you. The result returned by the agent is not visible to the user. To show the user the result, you should send a text message back to the user with a concise summary of the result.
- The agent's outputs should generally be trusted
- Clearly tell the agent whether you expect it to write code or just to do research (search, file reads, web fetches, etc.), since it is not aware of the user's intent.
- If the agent description mentions that it should be used proactively, then you should try your best to use it without the user having to ask for it first. Use your judgement.
${writingThePromptSection}

${currentExamples}`
}
