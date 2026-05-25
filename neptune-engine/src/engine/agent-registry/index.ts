export type {AgentManifest, AgentRegistry} from './AgentRegistry.js'
export {InMemoryAgentRegistry} from './InMemoryAgentRegistry.js'
export {FilesystemAgentRegistry} from './FilesystemAgentRegistry.js'

// Stage B1.3 + B3 — substrate baseline 4 agents
export {
	BUILT_IN_AGENT_MANIFESTS,
	GENERAL_PURPOSE_AGENT_MANIFEST,
	EXPLORE_AGENT_MANIFEST,
	PLAN_AGENT_MANIFEST,
	VERIFICATION_AGENT_MANIFEST,
} from './builtins/index.js'
