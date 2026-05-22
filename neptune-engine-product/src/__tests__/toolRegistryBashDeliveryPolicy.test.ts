import {describe, expect, mock, test} from 'bun:test'

function makeTool(name: string) {
	return {
		name,
		isEnabled() {
			return true
		},
		async prompt() {
			return `${name} base prompt`
		},
	}
}

mock.module(
	'@neptune/builtin-tools/tools/AgentTool/AgentTool.js',
	() => ({AgentTool: makeTool('Agent')}),
)

mock.module('@neptune/builtin-tools/tools/AgentTool/constants.js', () => ({
	AGENT_TOOL_NAME: 'Agent',
}))

mock.module('@neptune/builtin-tools/tools/AgentTool/forkSubagent.js', () => ({
	isForkSubagentEnabled() {
		return true
	},
}))

mock.module('@neptune/builtin-tools/tools/SendMessageTool/constants.js', () => ({
	SEND_MESSAGE_TOOL_NAME: 'SendMessage',
}))

mock.module(
	'@neptune/builtin-tools/tools/BashTool/BashTool.js',
	() => ({BashTool: makeTool('Bash')}),
)

mock.module('@neptune/builtin-tools/tools/BashTool/toolName.js', () => ({
	BASH_TOOL_NAME: 'Bash',
}))

mock.module(
	'@neptune/builtin-tools/tools/FileEditTool/FileEditTool.js',
	() => ({FileEditTool: makeTool('Edit')}),
)

mock.module(
	'@neptune/builtin-tools/tools/FileReadTool/FileReadTool.js',
	() => ({FileReadTool: makeTool('Read')}),
)

mock.module(
	'@neptune/builtin-tools/tools/FileWriteTool/FileWriteTool.js',
	() => ({FileWriteTool: makeTool('Write')}),
)

mock.module(
	'@neptune/builtin-tools/tools/GlobTool/GlobTool.js',
	() => ({GlobTool: makeTool('Glob')}),
)

mock.module(
	'@neptune/builtin-tools/tools/GrepTool/GrepTool.js',
	() => ({GrepTool: makeTool('Grep')}),
)

mock.module(
	'@neptune/builtin-tools/tools/NotebookEditTool/NotebookEditTool.js',
	() => ({NotebookEditTool: makeTool('NotebookEdit')}),
)

mock.module(
	'@neptune/builtin-tools/tools/WebFetchTool/WebFetchTool.js',
	() => ({WebFetchTool: makeTool('WebFetch')}),
)

mock.module(
	'@neptune/builtin-tools/tools/WebSearchTool/WebSearchTool.js',
	() => ({WebSearchTool: makeTool('WebSearch')}),
)

mock.module(
	'@neptune/builtin-tools/tools/TaskCreateTool/TaskCreateTool.js',
	() => ({TaskCreateTool: makeTool('TaskCreate')}),
)

mock.module(
	'@neptune/builtin-tools/tools/TaskGetTool/TaskGetTool.js',
	() => ({TaskGetTool: makeTool('TaskGet')}),
)

mock.module(
	'@neptune/builtin-tools/tools/TaskUpdateTool/TaskUpdateTool.js',
	() => ({TaskUpdateTool: makeTool('TaskUpdate')}),
)

mock.module(
	'@neptune/builtin-tools/tools/TaskListTool/TaskListTool.js',
	() => ({TaskListTool: makeTool('TaskList')}),
)

mock.module(
	'@neptune/builtin-tools/tools/TaskStopTool/TaskStopTool.js',
	() => ({TaskStopTool: makeTool('TaskStop')}),
)

mock.module(
	'@neptune/builtin-tools/tools/TaskOutputTool/TaskOutputTool.js',
	() => ({TaskOutputTool: makeTool('TaskOutput')}),
)

mock.module(
	'@neptune/builtin-tools/tools/ExitPlanModeTool/ExitPlanModeV2Tool.js',
	() => ({ExitPlanModeV2Tool: makeTool('ExitPlanMode')}),
)

mock.module('@neptune/builtin-tools/tools/TodoWriteTool/constants.js', () => ({
	TODO_WRITE_TOOL_NAME: 'TodoWrite',
}))

mock.module('../utils/tool-ui-adapters/registry.js', () => ({
	applyProductToolUiOverrides<T>(tool: T): T {
		return tool
	},
}))

mock.module('../utils/agentSwarmsEnabled.js', () => ({
	isAgentSwarmsEnabled() {
		return false
	},
}))

mock.module('../utils/worktreeModeEnabled.js', () => ({
	isWorktreeModeEnabled() {
		return false
	},
}))

mock.module('src/utils/envUtils.js', () => ({
	isEnvTruthy() {
		return false
	},
}))

mock.module('src/utils/auth.js', () => ({
	getSubscriptionType() {
		return 'max'
	},
}))

mock.module('src/utils/gitSettings.js', () => ({
	shouldIncludeGitInstructions() {
		return true
	},
}))

mock.module('src/utils/attribution.js', () => ({
	getAttributionTexts() {
		return {
			commit: '',
			pr: '',
		}
	},
}))

mock.module('src/utils/undercover.js', () => ({
	getUndercoverInstructions() {
		return ''
	},
	isUndercover() {
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

mock.module('bun:bundle', () => ({
	feature() {
		return false
	},
}))

const {DefaultToolRegistry} = await import('../DefaultToolRegistry.js')

describe('product tool registries Bash delivery policy', () => {
	test.each([
		['sdk', () => new DefaultToolRegistry({mode: 'sdk'})],
		['cli', () => new DefaultToolRegistry({mode: 'cli'})],
	])('%s registry wraps Bash with product delivery policy', async (_, create) => {
		const registry = create()
		const bash = registry.getToolByName('Bash')

		expect(bash).toBeDefined()
		const prompt = await bash!.prompt({} as never)

		expect(prompt).toContain('# Committing changes with git')
		expect(prompt).toContain('# Creating pull requests')
		expect(prompt).toContain('gh pr create')
	})
})

describe('product tool registries Agent delivery policy', () => {
	test.each([
		['sdk', () => new DefaultToolRegistry({mode: 'sdk'})],
		['cli', () => new DefaultToolRegistry({mode: 'cli'})],
	])('%s registry wraps Agent with product delivery policy', async (_, create) => {
		const registry = create()
		const agent = registry.getToolByName('Agent')

		expect(agent).toBeDefined()
		const prompt = await agent!.prompt({} as never)

		expect(prompt).toContain('# Agent delivery policy')
		expect(prompt).toContain('SendMessage')
		expect(prompt).toContain('isolation: "worktree"')
		expect(prompt).toContain('## When to fork')
	})
})
