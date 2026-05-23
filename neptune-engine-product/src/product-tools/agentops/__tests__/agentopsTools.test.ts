import {describe, expect, mock, test} from 'bun:test'

mock.module('axios', () => ({
	default: {
		async request() {
			return {
				status: 200,
				data: {ok: true},
			}
		},
	},
}))

mock.module('src/constants/oauth.js', () => ({
	getOauthConfig() {
		return {
			BASE_API_URL: 'https://api.example.test',
		}
	},
}))

mock.module('src/services/analytics/growthbook.js', () => ({
	getFeatureValue_CACHED_MAY_BE_STALE() {
		return true
	},
}))

mock.module('src/services/oauth/client.js', () => ({
	async getOrganizationUUID() {
		return 'org_test'
	},
}))

mock.module('src/services/policyLimits/index.js', () => ({
	isPolicyAllowed() {
		return true
	},
}))

mock.module('src/utils/auth.js', () => ({
	async checkAndRefreshOAuthTokenIfNeeded() {},
	getClaudeAIOAuthTokens() {
		return {
			accessToken: 'token_test',
		}
	},
}))

mock.module('../../../utils/slowOperations.js', () => ({
	jsonStringify(value: unknown) {
		return JSON.stringify(value)
	},
}))

const {RemoteTriggerTool} = await import('../remote-trigger/RemoteTriggerTool.js')
const {REMOTE_TRIGGER_TOOL_NAME} = await import('../remote-trigger/prompt.js')
const {ReviewArtifactTool} = await import(
	'../review-artifact/ReviewArtifactTool.js'
)
const {SubscribePRTool} = await import('../subscribe-pr/SubscribePRTool.js')
const {SuggestBackgroundPRTool} = await import(
	'../suggest-background-pr/SuggestBackgroundPRTool.js'
)

const toolUseContext = {
	abortController: new AbortController(),
} as never

describe('product-owned AgentOps tools', () => {
	test('preserves tool names and read-only semantics', () => {
		expect(SuggestBackgroundPRTool.name).toBe('SuggestBackgroundPR')
		expect(SubscribePRTool.name).toBe('SubscribePR')
		expect(RemoteTriggerTool.name).toBe(REMOTE_TRIGGER_TOOL_NAME)
		expect(ReviewArtifactTool.name).toBe('ReviewArtifact')

		expect(SuggestBackgroundPRTool.isReadOnly()).toBe(true)
		expect(SubscribePRTool.isReadOnly()).toBe(true)
		expect(RemoteTriggerTool.isReadOnly?.({action: 'list'})).toBe(true)
		expect(RemoteTriggerTool.isReadOnly?.({action: 'get'})).toBe(true)
		expect(RemoteTriggerTool.isReadOnly?.({action: 'create'})).toBe(false)
		expect(ReviewArtifactTool.isReadOnly()).toBe(true)
	})

	test('keeps background PR and PR subscription fallbacks product-owned', async () => {
		const suggestion = await SuggestBackgroundPRTool.call(
			{
				title: 'Follow-up cleanup',
				description: 'Move remaining product workflow policy out of runtime.',
			},
		)
		const subscription = await SubscribePRTool.call(
			{
				repo: 'neptune/lab',
				pr_number: 42,
			},
		)

		expect(suggestion.data).toMatchObject({
			suggested: false,
			suggestion_id: '',
		})
		expect(subscription.data).toMatchObject({
			subscribed: false,
			subscription_id: '',
		})
		expect(
			SuggestBackgroundPRTool.mapToolResultToToolResultBlockParam?.(
				suggestion.data,
				'toolu_suggest',
			),
		).toEqual({
			tool_use_id: 'toolu_suggest',
			type: 'tool_result',
			content: 'Failed to record PR suggestion.',
		})
		expect(
			SubscribePRTool.mapToolResultToToolResultBlockParam?.(
				subscription.data,
				'toolu_subscribe',
			),
		).toEqual({
			tool_use_id: 'toolu_subscribe',
			type: 'tool_result',
			content: 'Failed to subscribe to PR events.',
		})
	})

	test('maps remote trigger and review artifact outputs for model consumption', async () => {
		expect(
			RemoteTriggerTool.toAutoClassifierInput?.({
				action: 'run',
				trigger_id: 'trigger_123',
			}),
		).toBe('RemoteTrigger run trigger_123')
		expect(
			RemoteTriggerTool.mapToolResultToToolResultBlockParam?.(
				{status: 200, json: '{"ok":true}'},
				'toolu_remote',
			),
		).toEqual({
			tool_use_id: 'toolu_remote',
			type: 'tool_result',
			content: 'HTTP 200\n{"ok":true}',
		})

		const review = await ReviewArtifactTool.call(
			{
				artifact: 'const ok = true',
				title: 'example.ts',
				annotations: [
					{
						line: 1,
						message: 'Looks good.',
						severity: 'info',
					},
				],
				summary: 'One annotation.',
			},
			toolUseContext,
		)

		expect(review.data).toEqual({
			artifact: 'const ok = true',
			title: 'example.ts',
			annotationCount: 1,
			summary: 'One annotation.',
		})
		expect(
			ReviewArtifactTool.mapToolResultToToolResultBlockParam?.(
				review.data,
				'toolu_review',
			),
		).toEqual({
			tool_use_id: 'toolu_review',
			type: 'tool_result',
			content: 'Review delivered with 1 annotation(s). Summary: One annotation.',
		})
	})
})
