import {describe, expect, test} from 'bun:test'
import {
	mapAgentToolResultToBlock,
	type AgentCompletedResult,
} from '../resultMapping.js'

function textContent(result: ReturnType<typeof mapAgentToolResultToBlock>) {
	const content = result.content
	if (!Array.isArray(content)) return ''
	return content
		.map(block => (block.type === 'text' ? block.text : ''))
		.join('\n')
}

describe('AgentTool result runtime boundary', () => {
	test('keeps async launch result free of product delivery instructions', () => {
		const text = textContent(
			mapAgentToolResultToBlock(
				{
					status: 'async_launched',
					agentId: 'agent-123',
					description: 'scan',
					prompt: 'scan files',
					outputFile: '/tmp/agent-output.jsonl',
					canReadOutputFile: true,
				},
				'toolu-1',
			),
		)

		expect(text).toContain('Async agent launched.')
		expect(text).toContain('agentId: agent-123')
		expect(text).toContain('output_file: /tmp/agent-output.jsonl')
		expect(text).not.toContain('Briefly tell the user')
		expect(text).not.toContain('Do not duplicate')
		expect(text).not.toContain('SendMessage')
		expect(text).not.toContain('Read/Bash')
	})

	test('keeps completed result trailer as runtime metadata only', () => {
		const text = textContent(
			mapAgentToolResultToBlock(
				{
					status: 'completed',
					agentId: 'agent-456',
					agentType: 'general-purpose',
					content: [
						{
							type: 'text',
							text: 'done',
						},
					],
					totalTokens: 42,
					totalToolUseCount: 3,
					totalDurationMs: 1000,
				} satisfies AgentCompletedResult,
				'toolu-2',
			),
		)

		expect(text).toContain('agentId: agent-456')
		expect(text).toContain('<usage>total_tokens: 42')
		expect(text).not.toContain('SendMessage')
		expect(text).not.toContain('continue this agent')
	})

	test('keeps remote launch result free of CCR delivery instructions', () => {
		const text = textContent(
			mapAgentToolResultToBlock(
				{
					status: 'remote_launched',
					taskId: 'task-1',
					sessionUrl: 'https://example.test/session',
					description: 'remote scan',
					prompt: 'scan remotely',
					outputFile: '/tmp/remote-output.jsonl',
				},
				'toolu-3',
			),
		)

		expect(text).toContain('Remote agent launched.')
		expect(text).toContain('taskId: task-1')
		expect(text).toContain('session_url: https://example.test/session')
		expect(text).toContain('output_file: /tmp/remote-output.jsonl')
		expect(text).not.toContain('CCR')
		expect(text).not.toContain('Briefly tell the user')
		expect(text).not.toContain('notified automatically')
	})
})
