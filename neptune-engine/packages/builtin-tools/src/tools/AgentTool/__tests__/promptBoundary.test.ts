import {describe, expect, mock, test} from 'bun:test'

mock.module('src/services/analytics/growthbook.js', () => ({
	getFeatureValue_CACHED_MAY_BE_STALE() {
		return false
	},
}))

mock.module('src/utils/embeddedTools.js', () => ({
	hasEmbeddedSearchTools() {
		return false
	},
}))

mock.module('src/utils/envUtils.js', () => ({
	isEnvDefinedFalsy() {
		return false
	},
	isEnvTruthy() {
		return false
	},
}))

mock.module('../forkSubagent.js', () => ({
	isForkSubagentEnabled() {
		return true
	},
}))

mock.module('../../FileReadTool/prompt.js', () => ({
	FILE_READ_TOOL_NAME: 'Read',
}))

mock.module('../../FileWriteTool/prompt.js', () => ({
	FILE_WRITE_TOOL_NAME: 'Write',
}))

mock.module('../../GlobTool/prompt.js', () => ({
	GLOB_TOOL_NAME: 'Glob',
}))

mock.module('../constants.js', () => ({
	AGENT_TOOL_NAME: 'Agent',
}))

const {getPrompt} = await import('../prompt.js')

describe('AgentTool prompt runtime boundary', () => {
	test('excludes product fork, worktree, remote, and parallel delivery policy', async () => {
		const prompt = await getPrompt(
			[
				{
					agentType: 'reviewer',
					whenToUse: 'review code',
				},
			] as never,
			false,
		)

		expect(prompt).toContain('Launch a new agent')
		expect(prompt).toContain('Writing the prompt')
		expect(prompt).not.toContain('# Agent delivery policy')
		expect(prompt).not.toContain('## When to fork')
		expect(prompt).not.toContain('isolation: "worktree"')
		expect(prompt).not.toContain('remote CCR environment')
		expect(prompt).not.toContain('output_file')
		expect(prompt).not.toContain('run agents "in parallel"')
		expect(prompt).not.toContain('SendMessage')
	})
})
