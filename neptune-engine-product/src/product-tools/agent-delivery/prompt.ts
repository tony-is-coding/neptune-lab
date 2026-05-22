import {AGENT_TOOL_NAME} from '@neptune/builtin-tools/tools/AgentTool/constants.js'
import {isForkSubagentEnabled} from '@neptune/builtin-tools/tools/AgentTool/forkSubagent.js'
import {SEND_MESSAGE_TOOL_NAME} from '@neptune/builtin-tools/tools/SendMessageTool/constants.js'
import type {Tool} from '../../Tool.js'
import {getSubscriptionType} from 'src/utils/auth.js'
import {isEnvTruthy} from 'src/utils/envUtils.js'
import {isTeammate} from 'src/utils/teammate.js'
import {isInProcessTeammate} from 'src/utils/teammateContext.js'
import {applyAgentDeliveryResultMapping} from './result.js'

function getAgentDeliveryPolicyPrompt({
	listViaAttachment,
}: {
	listViaAttachment: boolean
}): string {
	const forkEnabled = isForkSubagentEnabled()

	const concurrencyNote =
		!listViaAttachment && getSubscriptionType() !== 'pro'
			? `
- Launch multiple agents concurrently whenever possible, to maximize performance; to do that, use a single message with multiple tool uses.`
			: ''

	const backgroundNote =
		!isEnvTruthy(process.env.CLAUDE_CODE_DISABLE_BACKGROUND_TASKS) &&
		!isInProcessTeammate() &&
		!forkEnabled
			? `
- You can optionally run agents in the background using the run_in_background parameter. When an agent runs in the background, you will be automatically notified when it completes — do NOT sleep, poll, or proactively check on its progress. Continue with other work or respond to the user instead.
- **Foreground vs background**: Use foreground (default) when you need the agent's results before you can proceed — e.g., research agents whose findings inform your next steps. Use background when you have genuinely independent work to do in parallel.`
			: ''

	const teammateNote = isInProcessTeammate()
		? `
- The run_in_background, name, team_name, and mode parameters are not available in this context. Only synchronous subagents are supported.`
		: isTeammate()
			? `
- The name, team_name, and mode parameters are not available in this context — teammates cannot spawn other teammates. Omit them to spawn a subagent.`
			: ''

	const forkSection = forkEnabled
		? `

## When to fork

Fork yourself (omit \`subagent_type\`) when the intermediate tool output isn't worth keeping in your context. The criterion is qualitative — "will I need this output again" — not task size.
- **Research**: fork open-ended questions. If research can be broken into independent questions, launch parallel forks in one message. A fork beats a fresh subagent for this — it inherits context and shares your cache.
- **Implementation**: prefer to fork implementation work that requires more than a couple of edits. Do research before jumping to implementation.

Forks are cheap because they share your prompt cache. Don't set \`model\` on a fork — a different model can't reuse the parent's cache. Pass a short \`name\` (one or two words, lowercase) so the user can see the fork in the teams panel and steer it mid-run.

**Don't peek.** The tool result includes an \`output_file\` path — do not Read or tail it unless the user explicitly asks for a progress check. You get a completion notification; trust it. Reading the transcript mid-flight pulls the fork's tool noise into your context, which defeats the point of forking.

**Don't race.** After launching, you know nothing about what the fork found. Never fabricate or predict fork results in any format — not as prose, summary, or structured output. The notification arrives as a user-role message in a later turn; it is never something you write yourself. If the user asks a follow-up before the notification lands, tell them the fork is still running — give status, not a guess.

**Writing a fork prompt.** Since the fork inherits your context, the prompt is a *directive* — what to do, not what the situation is. Be specific about scope: what's in, what's out, what another agent is handling. Don't re-explain background.
`
		: ''

	return `# Agent delivery policy

- To continue a previously spawned agent, use ${SEND_MESSAGE_TOOL_NAME} with the agent's ID or name as the \`to\` field. The agent resumes with its full context preserved. ${forkEnabled ? 'Each fresh Agent invocation with a subagent_type starts without context — provide a complete task description.' : 'Each Agent invocation starts fresh — provide a complete task description.'}${concurrencyNote}${backgroundNote}
- If the user specifies that they want you to run agents "in parallel", you MUST send a single message with multiple ${AGENT_TOOL_NAME} tool use content blocks. For example, if you need to launch both a build-validator agent and a test-runner agent in parallel, send a single message with both tool calls.
- You can optionally set \`isolation: "worktree"\` to run the agent in a temporary git worktree, giving it an isolated copy of the repository. The worktree is automatically cleaned up if the agent makes no changes; if changes are made, the worktree path and branch are returned in the result.${
		process.env.USER_TYPE === 'ant'
			? `\n- You can set \`isolation: "remote"\` to run the agent in a remote CCR environment. This is always a background task; you'll be notified when it completes. Use for long-running tasks that need a fresh sandbox.`
			: ''
	}${teammateNote}${forkSection}`
}

export function applyAgentDeliveryPolicy(tool: Tool): Tool {
	const toolWithResultMapping = applyAgentDeliveryResultMapping(tool)
	return {
		...toolWithResultMapping,
		async prompt(options) {
			const basePrompt = await toolWithResultMapping.prompt(options)
			const isCoordinatorPrompt =
				basePrompt.includes('Launch a new agent to handle') &&
				!basePrompt.includes('Usage notes:')
			if (isCoordinatorPrompt) return basePrompt

			const listViaAttachment = basePrompt.includes(
				'Available agent types are listed in <system-reminder> messages',
			)
			return `${basePrompt}\n\n${getAgentDeliveryPolicyPrompt({
				listViaAttachment,
			})}`
		},
	}
}
