import type {Tool} from '../../Tool.js'

export function getWebFetchDeliveryPolicyPrompt(): string {
	return `# WebFetch product routing

- For GitHub URLs, prefer using the gh CLI via the Bash tool instead of WebFetch when authenticated repository, issue, pull request, check, or release data is needed. Examples: gh pr view, gh issue view, gh api.`
}

export function applyWebFetchDeliveryPolicy(tool: Tool): Tool {
	return {
		...tool,
		async prompt(options) {
			const basePrompt = await tool.prompt(options)
			return `${basePrompt}\n\n${getWebFetchDeliveryPolicyPrompt()}`
		},
	}
}
