import type {
	AgentDefinition,
	AgentDefinitionsResult,
} from '@neptune/engine-product/cc-tools/AgentTool/loadAgentsDir.js'
import {
	CLAUDE_CODE_GUIDE_AGENT,
	CLAUDE_CODE_GUIDE_AGENT_TYPE,
} from './built-in/claudeCodeGuideAgent.js'
import {STATUSLINE_SETUP_AGENT} from './built-in/statuslineSetup.js'

export {CLAUDE_CODE_GUIDE_AGENT_TYPE}

type ProductBuiltInAgentOptions = {
	isNonInteractiveSession?: boolean
}

function isNonSdkEntrypoint(): boolean {
	return (
		process.env.CLAUDE_CODE_ENTRYPOINT !== 'sdk-ts' &&
		process.env.CLAUDE_CODE_ENTRYPOINT !== 'sdk-py' &&
		process.env.CLAUDE_CODE_ENTRYPOINT !== 'sdk-cli'
	)
}

function isEnvTruthy(envVar: string | boolean | undefined): boolean {
	if (!envVar) return false
	if (typeof envVar === 'boolean') return envVar
	return ['1', 'true', 'yes', 'on'].includes(envVar.toLowerCase().trim())
}

function isNonInteractiveSession(
	options?: ProductBuiltInAgentOptions,
): boolean {
	if (options?.isNonInteractiveSession !== undefined) {
		return options.isNonInteractiveSession
	}
	/* eslint-disable @typescript-eslint/no-require-imports */
	const {getIsNonInteractiveSession} =
		require('src/bootstrap/state.js') as typeof import('src/bootstrap/state.js')
	/* eslint-enable @typescript-eslint/no-require-imports */
	return getIsNonInteractiveSession()
}

function shouldDisableBuiltInAgents(
	options?: ProductBuiltInAgentOptions,
): boolean {
	return (
		isEnvTruthy(process.env.CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS) &&
		isNonInteractiveSession(options)
	)
}

function isProductBuiltInAgent(agent: AgentDefinition): boolean {
	return (
		agent.agentType === 'statusline-setup' ||
		agent.agentType === CLAUDE_CODE_GUIDE_AGENT_TYPE
	)
}

export function getProductBuiltInAgents(
	options?: ProductBuiltInAgentOptions,
): AgentDefinition[] {
	if (shouldDisableBuiltInAgents(options)) {
		return []
	}

	const agents: AgentDefinition[] = [STATUSLINE_SETUP_AGENT]

	if (isNonSdkEntrypoint()) {
		agents.push(CLAUDE_CODE_GUIDE_AGENT)
	}

	return agents
}

function getActiveAgentsFromList(allAgents: AgentDefinition[]): AgentDefinition[] {
	const builtInAgents = allAgents.filter(a => a.source === 'built-in')
	const pluginAgents = allAgents.filter(a => a.source === 'plugin')
	const userAgents = allAgents.filter(a => a.source === 'userSettings')
	const projectAgents = allAgents.filter(a => a.source === 'projectSettings')
	const managedAgents = allAgents.filter(a => a.source === 'policySettings')
	const flagAgents = allAgents.filter(a => a.source === 'flagSettings')
	const agentMap = new Map<string, AgentDefinition>()

	for (const agents of [
		builtInAgents,
		pluginAgents,
		userAgents,
		projectAgents,
		flagAgents,
		managedAgents,
	]) {
		for (const agent of agents) {
			agentMap.set(agent.agentType, agent)
		}
	}

	return Array.from(agentMap.values())
}

export function applyProductBuiltInAgents(
	definitions: AgentDefinitionsResult,
	options?: ProductBuiltInAgentOptions,
): AgentDefinitionsResult {
	const productBuiltInAgents = getProductBuiltInAgents(options)
	const baseAllAgents = definitions.allAgents.filter(
		agent => !isProductBuiltInAgent(agent) || agent.source !== 'built-in',
	)
	if (productBuiltInAgents.length === 0) {
		return {
			...definitions,
			allAgents: baseAllAgents,
			activeAgents: getActiveAgentsFromList(baseAllAgents),
		}
	}

	const allAgents = insertProductBuiltInAgents(
		baseAllAgents,
		productBuiltInAgents,
	)

	return {
		...definitions,
		allAgents,
		activeAgents: getActiveAgentsFromList(allAgents),
	}
}

function insertProductBuiltInAgents(
	allAgents: AgentDefinition[],
	productBuiltInAgents: AgentDefinition[],
): AgentDefinition[] {
	const statusline = productBuiltInAgents.find(
		a => a.agentType === 'statusline-setup',
	)
	const guide = productBuiltInAgents.find(
		a => a.agentType === CLAUDE_CODE_GUIDE_AGENT_TYPE,
	)
	const result: AgentDefinition[] = []
	let insertedStatusline = false
	let insertedGuide = false
	let insertedVerification = false

	for (const agent of allAgents) {
		result.push(agent)

		if (!insertedStatusline && agent.agentType === 'general-purpose') {
			if (statusline) result.push(statusline)
			insertedStatusline = true
		}

		if (!insertedGuide && agent.agentType === 'plan') {
			if (guide) result.push(guide)
			insertedGuide = true
		}

		if (agent.agentType === 'verification') {
			insertedVerification = true
		}
	}

	if (!insertedStatusline && statusline) {
		result.push(statusline)
	}
	if (!insertedGuide && guide) {
		const index = insertedVerification
			? result.findIndex(agent => agent.agentType === 'verification')
			: -1
		if (index >= 0) {
			result.splice(index, 0, guide)
		} else {
			result.push(guide)
		}
	}

	return result
}
