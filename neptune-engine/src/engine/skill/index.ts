/**
 * Skill protocol — public exports for engine consumers.
 *
 * See docs/strategy/neptune-engine-runtime-kernel-design.md §3.
 */

export type {
	RegisteredSkill,
	SkillManifest,
	SkillRegistry,
	SkillSource,
} from './types.js'

export {
	parseSkillMarkdown,
	serializeSkillToMarkdown,
	validateSkillManifest,
	SkillFormatError,
} from './SkillFormatter.js'

export {InMemorySkillRegistry} from './InMemorySkillRegistry.js'
