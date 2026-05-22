import {describe, expect, mock, test} from 'bun:test'

mock.module('../../../bootstrap/state.js', () => ({
	getKairosActive() {
		return false
	},
	getUserMsgOptIn() {
		return true
	},
}))

mock.module('src/bootstrap/state.js', () => ({
	isReplBridgeActive() {
		return false
	},
}))

mock.module('../../../services/analytics/growthbook.js', () => ({
	getFeatureValue_CACHED_WITH_REFRESH() {
		return true
	},
}))

mock.module('src/services/analytics/growthbook.js', () => ({
	getFeatureValue_CACHED_MAY_BE_STALE() {
		return false
	},
}))

mock.module('../../../services/analytics/index.js', () => ({
	logEvent() {},
}))

mock.module('../../../utils/cwd.js', () => ({
	getCwd() {
		return '/tmp/neptune'
	},
}))

mock.module('../../../utils/envUtils.js', () => ({
	isEnvTruthy() {
		return false
	},
}))

mock.module('../../../utils/imagePaste.js', () => ({
	IMAGE_EXTENSION_REGEX: /\.(png|jpg|jpeg|gif|webp)$/i,
}))

mock.module('../../../utils/path.js', () => ({
	expandPath(path: string) {
		return path.startsWith('/') ? path : `/tmp/neptune/${path}`
	},
}))

mock.module('bun:bundle', () => ({
	feature(name: string) {
		return name === 'KAIROS_BRIEF'
	},
}))

const {BRIEF_TOOL_NAME, BriefTool} = await import('../BriefTool.js')
const {isDeferredTool} = await import(
	'@neptune/builtin-tools/tools/ToolSearchTool/prompt.js'
)

describe('Brief product tool', () => {
	test('defines SendUserMessage in the product layer', async () => {
		expect(BRIEF_TOOL_NAME).toBe('SendUserMessage')
		expect(BriefTool.name).toBe('SendUserMessage')
		expect(BriefTool.aliases).toContain('Brief')
		expect(BriefTool.alwaysLoad).toBe(true)
		expect(await BriefTool.prompt()).toContain('Send a message')
	})

	test('maps delivery result to model-facing acknowledgement', () => {
		const result = BriefTool.mapToolResultToToolResultBlockParam(
			{
				message: 'done',
				attachments: [
					{
						path: '/tmp/report.txt',
						size: 12,
						isImage: false,
					},
				],
			},
			'toolu_1',
		)

		expect(result).toEqual({
			tool_use_id: 'toolu_1',
			type: 'tool_result',
			content: 'Message delivered to user. (1 attachment included)',
		})
	})

	test('returns message output without attachments', async () => {
		const result = await BriefTool.call(
			{
				message: 'hello',
				status: 'normal',
			},
			{
				getAppState() {
					return {replBridgeEnabled: false}
				},
				abortController: new AbortController(),
			},
		)

		expect(result.data.message).toBe('hello')
		expect(result.data.sentAt).toBeString()
		expect(result.data.attachments).toBeUndefined()
	})

	test('keeps SendUserMessage visible before ToolSearch', () => {
		expect(isDeferredTool(BriefTool)).toBe(false)
	})
})
