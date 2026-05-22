import {beforeEach, describe, expect, mock, test} from 'bun:test'

let forkEnabled = true
let subscriptionType = 'max'
mock.module('@neptune/builtin-tools/tools/AgentTool/constants.js', () => ({
	AGENT_TOOL_NAME: 'Agent',
}))

mock.module('@neptune/builtin-tools/tools/AgentTool/forkSubagent.js', () => ({
	isForkSubagentEnabled() {
		return forkEnabled
	},
}))

mock.module('@neptune/builtin-tools/tools/SendMessageTool/constants.js', () => ({
	SEND_MESSAGE_TOOL_NAME: 'SendMessage',
}))

mock.module('src/utils/auth.js', () => ({
	getSubscriptionType() {
		return subscriptionType
	},
}))

mock.module('src/utils/envUtils.js', () => ({
	isEnvTruthy() {
		return false
	},
}))

mock.module('src/utils/teammate.js', () => ({
	isTeammate() {
		return false
	},
}))

mock.module('src/utils/teammateContext.js', () => ({
	isInProcessTeammate() {
		return false
	},
}))

const {applyAgentDeliveryPolicy} = await import('../prompt.js')

describe('product Agent delivery policy', () => {
	beforeEach(() => {
		forkEnabled = true
		subscriptionType = 'max'
		process.env.USER_TYPE = ''
	})

	test('appends fork, parallel, worktree, and resume guidance outside builtin Agent runtime', async () => {
		const baseTool = {
			name: 'Agent',
			async prompt(_options: unknown) {
				return 'Base Agent runtime prompt'
			},
		} as never

		const wrapped = applyAgentDeliveryPolicy(baseTool)
		const prompt = await wrapped.prompt({} as never)

		expect(prompt).toContain('Base Agent runtime prompt')
		expect(prompt).toContain('# Agent delivery policy')
		expect(prompt).toContain('SendMessage')
		expect(prompt).toContain('run agents "in parallel"')
		expect(prompt).toContain('isolation: "worktree"')
		expect(prompt).toContain('## When to fork')
		expect(prompt).toContain('output_file')
	})

	test('adds remote CCR guidance for ant users', async () => {
		process.env.USER_TYPE = 'ant'
		const wrapped = applyAgentDeliveryPolicy({
			name: 'Agent',
			async prompt(_options: unknown) {
				return 'Base Agent runtime prompt'
			},
		} as never)

		const prompt = await wrapped.prompt({} as never)

		expect(prompt).toContain('remote CCR environment')
	})

	test('omits concurrency note when agent list is delivered by attachment', async () => {
		subscriptionType = 'team'
		const wrapped = applyAgentDeliveryPolicy({
			name: 'Agent',
			async prompt(_options: unknown) {
				return 'Available agent types are listed in <system-reminder> messages'
			},
		} as never)

		const prompt = await wrapped.prompt({} as never)

		expect(prompt).not.toContain('Launch multiple agents concurrently')
	})

	test('leaves coordinator slim prompts unchanged', async () => {
		const basePrompt =
			'Launch a new agent to handle complex, multi-step tasks autonomously.'
		const wrapped = applyAgentDeliveryPolicy({
			name: 'Agent',
			async prompt(_options: unknown) {
				return basePrompt
			},
		} as never)

		const prompt = await wrapped.prompt({} as never)

		expect(prompt).toBe(basePrompt)
	})
})
