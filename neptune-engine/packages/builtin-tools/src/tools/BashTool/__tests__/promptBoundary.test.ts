import {describe, expect, mock, test} from 'bun:test'

mock.module('bun:bundle', () => ({
	feature() {
		return false
	},
}))

mock.module('src/constants/prompts.js', () => ({
	prependBullets(items: Array<string | string[]>) {
		return items.flatMap(item =>
			Array.isArray(item) ? item.map(subitem => `  - ${subitem}`) : [`- ${item}`],
		)
	},
}))

mock.module('src/utils/embeddedTools.js', () => ({
	hasEmbeddedSearchTools() {
		return false
	},
}))

mock.module('src/utils/envUtils.js', () => ({
	isEnvTruthy() {
		return false
	},
}))

mock.module('src/utils/permissions/filesystem.js', () => ({
	getClaudeTempDir() {
		return '/tmp/claude-test'
	},
}))

mock.module('src/utils/sandbox/sandbox-adapter.js', () => ({
	SandboxManager: {
		isSandboxingEnabled() {
			return false
		},
	},
}))

mock.module('src/utils/timeouts.js', () => ({
	getDefaultBashTimeoutMs() {
		return 120_000
	},
	getMaxBashTimeoutMs() {
		return 600_000
	},
}))

mock.module('../../AgentTool/constants.js', () => ({
	AGENT_TOOL_NAME: 'Agent',
}))

mock.module('../../FileEditTool/constants.js', () => ({
	FILE_EDIT_TOOL_NAME: 'Edit',
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

mock.module('../../GrepTool/prompt.js', () => ({
	GREP_TOOL_NAME: 'Grep',
}))

mock.module('../../TodoWriteTool/TodoWriteTool.js', () => ({
	TodoWriteTool: {
		name: 'TodoWrite',
	},
}))

const {getSimplePrompt} = await import('../prompt.js')

describe('BashTool prompt runtime boundary', () => {
	test('keeps shell/git safety but excludes product commit and PR delivery policy', () => {
		const prompt = getSimplePrompt()

		expect(prompt).toContain('For git commands:')
		expect(prompt).toContain('Never skip hooks')
		expect(prompt).not.toContain('# Committing changes with git')
		expect(prompt).not.toContain('# Creating pull requests')
		expect(prompt).not.toContain('gh pr create')
		expect(prompt).not.toContain('/commit-push-pr')
	})
})
