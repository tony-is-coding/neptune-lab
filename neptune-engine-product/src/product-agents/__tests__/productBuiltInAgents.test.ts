import {afterEach, beforeEach, describe, expect, test} from 'bun:test'
import type {AgentDefinition} from '@neptune/engine-product/cc-tools/AgentTool/loadAgentsDir.js'
import {
	applyProductBuiltInAgents,
	CLAUDE_CODE_GUIDE_AGENT_TYPE,
} from '../productBuiltInAgents.js'

const originalEntrypoint = process.env.CLAUDE_CODE_ENTRYPOINT
const originalDisableBuiltIns =
	process.env.CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS

afterEach(() => {
	if (originalEntrypoint === undefined) {
		delete process.env.CLAUDE_CODE_ENTRYPOINT
	} else {
		process.env.CLAUDE_CODE_ENTRYPOINT = originalEntrypoint
	}
	if (originalDisableBuiltIns === undefined) {
		delete process.env.CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS
	} else {
		process.env.CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS =
			originalDisableBuiltIns
	}
})

beforeEach(() => {
	delete process.env.CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS
})

function agent(agentType: string): AgentDefinition {
	return {
		agentType,
		whenToUse: `Use ${agentType}`,
		source: 'built-in',
		baseDir: 'built-in',
		getSystemPrompt: () => `${agentType} prompt`,
	}
}

describe('product built-in agents', () => {
	test('adds product-owned Claude Code agents to agent definitions', () => {
		delete process.env.CLAUDE_CODE_ENTRYPOINT

		const definitions = applyProductBuiltInAgents({
			activeAgents: [agent('general-purpose')],
			allAgents: [agent('general-purpose')],
		})

		const allAgentTypes = definitions.allAgents.map(a => a.agentType)
		const activeAgentTypes = definitions.activeAgents.map(a => a.agentType)

		expect(allAgentTypes).toContain('statusline-setup')
		expect(allAgentTypes).toContain(CLAUDE_CODE_GUIDE_AGENT_TYPE)
		expect(activeAgentTypes).toContain('statusline-setup')
		expect(activeAgentTypes).toContain(CLAUDE_CODE_GUIDE_AGENT_TYPE)
	})

	test('omits Claude Code guide for SDK entrypoints', () => {
		process.env.CLAUDE_CODE_ENTRYPOINT = 'sdk-ts'

		const definitions = applyProductBuiltInAgents({
			activeAgents: [agent('general-purpose')],
			allAgents: [agent('general-purpose')],
		})

		const allAgentTypes = definitions.allAgents.map(a => a.agentType)

		expect(allAgentTypes).toContain('statusline-setup')
		expect(allAgentTypes).not.toContain(CLAUDE_CODE_GUIDE_AGENT_TYPE)
	})

	test('preserves same-type overrides through active agent recomputation', () => {
		delete process.env.CLAUDE_CODE_ENTRYPOINT

		const productOverride = {
			...agent('statusline-setup'),
			source: 'projectSettings',
		} as AgentDefinition
		const definitions = applyProductBuiltInAgents({
			activeAgents: [],
			allAgents: [productOverride],
		})

		const activeStatusline = definitions.activeAgents.find(
			a => a.agentType === 'statusline-setup',
		)

		expect(activeStatusline?.source).toBe('projectSettings')
	})

	test('honors SDK disable built-ins switch in non-interactive sessions', () => {
		process.env.CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS = 'true'

		const definitions = applyProductBuiltInAgents({
			activeAgents: [],
			allAgents: [
				agent('general-purpose'),
				agent('statusline-setup'),
				agent(CLAUDE_CODE_GUIDE_AGENT_TYPE),
			],
		}, {isNonInteractiveSession: true})

		expect(definitions.allAgents.map(a => a.agentType)).toEqual([
			'general-purpose',
		])
		expect(definitions.activeAgents.map(a => a.agentType)).toEqual([
			'general-purpose',
		])
	})

	test('preserves old product built-in insertion order around runtime built-ins', () => {
		delete process.env.CLAUDE_CODE_ENTRYPOINT

		const definitions = applyProductBuiltInAgents({
			activeAgents: [],
			allAgents: [
				agent('general-purpose'),
				agent('explore'),
				agent('plan'),
				agent('verification'),
			],
		})

		expect(definitions.activeAgents.map(a => a.agentType)).toEqual([
			'general-purpose',
			'statusline-setup',
			'explore',
			'plan',
			CLAUDE_CODE_GUIDE_AGENT_TYPE,
			'verification',
		])
	})

	test('does not duplicate product built-ins when applied repeatedly', () => {
		delete process.env.CLAUDE_CODE_ENTRYPOINT

		const once = applyProductBuiltInAgents({
			activeAgents: [],
			allAgents: [agent('general-purpose')],
		})
		const twice = applyProductBuiltInAgents(once)

		expect(
			twice.allAgents.filter(a => a.agentType === 'statusline-setup'),
		).toHaveLength(1)
		expect(
			twice.allAgents.filter(
				a => a.agentType === CLAUDE_CODE_GUIDE_AGENT_TYPE,
			),
		).toHaveLength(1)
	})
})
