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
		expect(prompt).toContain('commit its changes before reporting')
		expect(prompt).toContain('commit hash')
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

	test('adds product delivery instructions to async launch results', () => {
		const wrapped = applyAgentDeliveryPolicy({
			name: 'Agent',
			async prompt(_options: unknown) {
				return 'Base Agent runtime prompt'
			},
			mapToolResultToToolResultBlockParam(output: unknown, toolUseID: string) {
				const data = output as {agentId: string; outputFile: string}
				return {
					tool_use_id: toolUseID,
					type: 'tool_result',
					content: [
						{
							type: 'text',
							text: `Async agent launched.\nagentId: ${data.agentId}\noutput_file: ${data.outputFile}`,
						},
					],
				}
			},
		} as never)

		const result = wrapped.mapToolResultToToolResultBlockParam(
			{
				status: 'async_launched',
				agentId: 'agent-123',
				outputFile: '/tmp/agent-output.jsonl',
				canReadOutputFile: true,
			},
			'toolu-1',
		)
		const text = (result.content as Array<{type: string; text?: string}>)
			.map(block => block.text ?? '')
			.join('\n')

		expect(text).toContain('Async agent launched.')
		expect(text).toContain('SendMessage')
		expect(text).toContain('Do not duplicate')
		expect(text).toContain('output_file: /tmp/agent-output.jsonl')
	})

	test('adds product delivery instructions to completed result trailers', () => {
		const wrapped = applyAgentDeliveryPolicy({
			name: 'Agent',
			async prompt(_options: unknown) {
				return 'Base Agent runtime prompt'
			},
			mapToolResultToToolResultBlockParam(output: unknown, toolUseID: string) {
				const data = output as {agentId: string}
				return {
					tool_use_id: toolUseID,
					type: 'tool_result',
					content: [
						{
							type: 'text',
							text: `agentId: ${data.agentId}`,
						},
					],
				}
			},
		} as never)

		const result = wrapped.mapToolResultToToolResultBlockParam(
			{
				status: 'completed',
				agentId: 'agent-456',
			},
			'toolu-2',
		)
		const text = (result.content as Array<{type: string; text?: string}>)
			.map(block => block.text ?? '')
			.join('\n')

		expect(text).toContain("agentId: agent-456")
		expect(text).toContain("Use SendMessage with to: 'agent-456'")
	})

	test('does not add continuation instructions to one-shot completed agents', () => {
		const wrapped = applyAgentDeliveryPolicy({
			name: 'Agent',
			async prompt(_options: unknown) {
				return 'Base Agent runtime prompt'
			},
			mapToolResultToToolResultBlockParam(_output: unknown, toolUseID: string) {
				return {
					tool_use_id: toolUseID,
					type: 'tool_result',
					content: [
						{
							type: 'text',
							text: 'exploration done',
						},
					],
				}
			},
		} as never)

		const result = wrapped.mapToolResultToToolResultBlockParam(
			{
				status: 'completed',
				agentId: 'agent-789',
				agentType: 'Explore',
			},
			'toolu-4',
		)
		const text = (result.content as Array<{type: string; text?: string}>)
			.map(block => block.text ?? '')
			.join('\n')

		expect(text).toContain('exploration done')
		expect(text).not.toContain('SendMessage')
		expect(text).not.toContain('continue this agent')
	})

	test('adds product delivery instructions to remote CCR launch results', () => {
		const wrapped = applyAgentDeliveryPolicy({
			name: 'Agent',
			async prompt(_options: unknown) {
				return 'Base Agent runtime prompt'
			},
			mapToolResultToToolResultBlockParam(output: unknown, toolUseID: string) {
				const data = output as {
					taskId: string
					sessionUrl: string
					outputFile: string
				}
				return {
					tool_use_id: toolUseID,
					type: 'tool_result',
					content: [
						{
							type: 'text',
							text: `Remote agent launched.\ntaskId: ${data.taskId}\nsession_url: ${data.sessionUrl}\noutput_file: ${data.outputFile}`,
						},
					],
				}
			},
		} as never)

		const result = wrapped.mapToolResultToToolResultBlockParam(
			{
				status: 'remote_launched',
				taskId: 'task-1',
				sessionUrl: 'https://example.test/session',
				outputFile: '/tmp/remote-output.jsonl',
			},
			'toolu-3',
		)
		const text = (result.content as Array<{type: string; text?: string}>)
			.map(block => block.text ?? '')
			.join('\n')

		expect(text).toContain('Remote agent launched.')
		expect(text).toContain('Remote agent launched in CCR')
		expect(text).toContain('Briefly tell the user')
	})
})
