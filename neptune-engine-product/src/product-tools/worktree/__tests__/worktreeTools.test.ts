import {describe, expect, mock, test} from 'bun:test'
import {
	ENTER_WORKTREE_TOOL_NAME,
	EXIT_WORKTREE_TOOL_NAME,
} from '../constants.js'

mock.module('../../../bootstrap/state.js', () => ({
	addToToolDuration() {},
	getCodeEditToolDecisionCounter() {
		return null
	},
	getCwdState() {
		return '/repo'
	},
	getKairosActive() {
		return false
	},
	getOriginalCwd() {
		return '/repo'
	},
	getProjectRoot() {
		return '/repo'
	},
	getSessionId() {
		return 'test-session'
	},
	getStatsStore() {
		return null
	},
	handleAutoModeTransition() {},
	handlePlanModeTransition() {},
	setOriginalCwd() {},
	setProjectRoot() {},
	setHasExitedPlanMode() {},
	setLastAPIRequest() {},
	setLastAPIRequestMessages() {},
	setNeedsAutoModeExitAttachment() {},
}))

mock.module('../../../constants/systemPromptSections.js', () => ({
	clearSystemPromptSections() {},
}))

mock.module('../../../services/analytics/index.js', () => ({
	logEvent() {},
}))

mock.module('../../../utils/claudemd.js', () => ({
	clearMemoryFileCaches() {},
}))

mock.module('../../../utils/cwd.js', () => ({
	getCwd() {
		return '/repo'
	},
}))

mock.module('../../../utils/git.js', () => ({
	findCanonicalGitRoot() {
		return '/repo'
	},
}))

mock.module('../../../utils/plans.js', () => ({
	getPlanSlug() {
		return 'test-plan'
	},
	getPlansDirectory: {
		cache: {
			clear() {},
		},
	},
}))

mock.module('../../../utils/Shell.js', () => ({
	setCwd() {},
}))

mock.module('../../../utils/sessionStorage.js', () => ({
	saveWorktreeState() {},
}))

mock.module('../../../utils/worktree.js', () => ({
	async cleanupWorktree() {},
	async createWorktreeForSession() {
		return {
			worktreePath: '/repo/.claude/worktrees/test-plan',
			worktreeBranch: 'test-plan',
		}
	},
	getCurrentWorktreeSession() {
		return null
	},
	async keepWorktree() {},
	async killTmuxSession() {},
	validateWorktreeSlug() {},
}))

mock.module('../../../utils/execFileNoThrow.js', () => ({
	async execFileNoThrow() {
		return {code: 0, stdout: '', stderr: ''}
	},
}))

mock.module('../../../utils/hooks/hooksConfigSnapshot.js', () => ({
	updateHooksConfigSnapshot() {},
}))

const {EnterWorktreeTool} = await import('../EnterWorktreeTool.js')
const {ExitWorktreeTool} = await import('../ExitWorktreeTool.js')

describe('product-owned worktree tools', () => {
	test('preserves tool names and use messages', () => {
		expect(EnterWorktreeTool.name).toBe(ENTER_WORKTREE_TOOL_NAME)
		expect(ExitWorktreeTool.name).toBe(EXIT_WORKTREE_TOOL_NAME)
		const renderOptions = {
			theme: 'dark' as const,
			verbose: false,
		}
		expect(EnterWorktreeTool.renderToolUseMessage?.({}, renderOptions)).toBe(
			'Creating worktree...',
		)
		expect(
			ExitWorktreeTool.renderToolUseMessage?.(
				{action: 'keep'},
				renderOptions,
			),
		).toBe('Exiting worktree...')
	})

	test('keeps remove marked destructive and keep non-destructive', () => {
		expect(ExitWorktreeTool.isDestructive?.({action: 'remove'})).toBe(true)
		expect(ExitWorktreeTool.isDestructive?.({action: 'keep'})).toBe(false)
	})

	test('exit validation is a no-op outside an active worktree session', async () => {
		const result = await ExitWorktreeTool.validateInput?.(
			{action: 'keep'},
			{} as never,
		)

		expect(result).toEqual({
			result: false,
			message:
				'No-op: there is no active EnterWorktree session to exit. This tool only operates on worktrees created by EnterWorktree in the current session — it will not touch worktrees created manually or in a previous session. No filesystem changes were made.',
			errorCode: 1,
		})
	})
})
