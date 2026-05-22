import {beforeEach, describe, expect, mock, test} from 'bun:test'

let remoteEnabled = true
let gateEnabled = true
let diffResult: unknown = {
	filename: 'src/file.ts',
	status: 'modified',
	additions: 2,
	deletions: 1,
	changes: 3,
	patch: '@@ -1 +1 @@\n-old\n+new',
	repository: 'owner/repo',
}
let diffError: Error | null = null
let diffCalls = 0
let diffFilePaths: string[] = []
let events: Array<Record<string, unknown>> = []

mock.module('src/utils/envUtils.js', () => ({
	isEnvTruthy() {
		return remoteEnabled
	},
}))

mock.module('src/services/analytics/growthbook.js', () => ({
	getFeatureValue_CACHED_MAY_BE_STALE() {
		return gateEnabled
	},
}))

mock.module('src/services/analytics/index.js', () => ({
	logEvent(_name: string, data: Record<string, unknown>) {
		events.push(data)
	},
}))

mock.module('src/utils/gitDiff.js', () => ({
	async fetchSingleFileGitDiff(filePath: string) {
		diffCalls++
		diffFilePaths.push(filePath)
		if (diffError) throw diffError
		return diffResult
	},
}))

mock.module('src/utils/path.js', () => ({
	expandPath(filePath: string) {
		if (filePath.startsWith('/')) return filePath
		return `/repo/${filePath}`
	},
}))

const {enrichFileToolGitDiff} = await import('../fileToolGitDiffEnrichment.js')

describe('file tool gitDiff enrichment', () => {
	beforeEach(() => {
		remoteEnabled = true
		gateEnabled = true
		diffResult = {
			filename: 'src/file.ts',
			status: 'modified',
			additions: 2,
			deletions: 1,
			changes: 3,
			patch: '@@ -1 +1 @@\n-old\n+new',
			repository: 'owner/repo',
		}
		diffError = null
		diffCalls = 0
		diffFilePaths = []
		events = []
	})

	test('adds product-side gitDiff for remote file edit output', async () => {
		const output = {
			filePath: '/repo/src/file.ts',
			originalFile: 'old',
			structuredPatch: [],
		}

		const enriched = await enrichFileToolGitDiff({
			toolName: 'Edit',
			output,
		})

		expect(enriched).toEqual({...output, gitDiff: diffResult})
		expect(diffCalls).toBe(1)
		expect(diffFilePaths).toEqual(['/repo/src/file.ts'])
		expect(events).toEqual([
			{
				isEditTool: true,
				isWriteTool: false,
				durationMs: expect.any(Number),
				hasDiff: true,
			},
		])
	})

	test('expands relative file paths before computing product-side gitDiff', async () => {
		const output = {
			filePath: 'src/file.ts',
			structuredPatch: [],
		}

		const enriched = await enrichFileToolGitDiff({
			toolName: 'Edit',
			output,
		})

		expect(enriched).toEqual({...output, gitDiff: diffResult})
		expect(diffFilePaths).toEqual(['/repo/src/file.ts'])
	})

	test('leaves output unchanged when remote gate is disabled', async () => {
		remoteEnabled = false
		const output = {filePath: '/repo/src/file.ts'}

		const enriched = await enrichFileToolGitDiff({
			toolName: 'Write',
			output,
		})

		expect(enriched).toBe(output)
		expect(diffCalls).toBe(0)
	})

	test('leaves output unchanged when diff lookup fails open', async () => {
		remoteEnabled = true
		diffResult = null
		const output = {filePath: '/repo/src/file.ts'}

		const enriched = await enrichFileToolGitDiff({
			toolName: 'Write',
			output,
		})

		expect(enriched).toBe(output)
		expect(diffCalls).toBe(1)
		expect(events.at(-1)).toMatchObject({
			isWriteTool: true,
			hasDiff: false,
		})
	})

	test('fails open when diff lookup throws', async () => {
		diffError = new Error('git unavailable')
		const output = {filePath: '/repo/src/file.ts'}

		const enriched = await enrichFileToolGitDiff({
			toolName: 'Write',
			output,
		})

		expect(enriched).toBe(output)
		expect(diffCalls).toBe(1)
		expect(events.at(-1)).toMatchObject({
			isWriteTool: true,
			hasDiff: false,
		})
	})
})
