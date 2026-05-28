/**
 * SkillTool prompt — 教 LLM 如何使用 Skill
 *
 * 设计目的（B6）：
 * - skill 是声明式 sub-agent 模板（markdown + frontmatter / 编程注入）
 * - LLM 通过 DiscoverSkills 看到列表，通过 Skill(name) 调用
 *
 * 剥离 cc 业务：
 * - 不抄 slash-command / processPromptSlashCommand / plugin marketplace
 * - 不抄 EXPERIMENTAL_SKILL_SEARCH / canonical skill 远程加载
 * - 不抄 SAFE_SKILL_PROPERTIES allowlist / pluginInfo
 */

import type {SkillManifest} from '@neptune/engine'
import {SKILL_TOOL_NAME} from './constants.js'

const WHEN_TO_USE = `
Use the ${SKILL_TOOL_NAME} tool when the task matches a skill the user has registered.

Skills are declarative sub-agent templates: each skill has a name, description,
system prompt, and optional tool whitelist / model preference. When you invoke a
skill, the runtime spawns a sub-agent using the skill's prompt as its system
prompt and your input as the first user message.`

const WHEN_NOT_TO_USE = `
When NOT to use the ${SKILL_TOOL_NAME} tool:
- If a regular tool (FileRead, Bash, Grep, etc.) can do it directly.
- If the task is not declared as a skill in this session.
- If you are inside another skill execution (don't recursively re-invoke skills).`

const HOW_TO_DISCOVER = `
Use the DiscoverSkills tool first to enumerate available skills, then call
${SKILL_TOOL_NAME} with the chosen skill name and optional args.`

function formatSkillLine(s: SkillManifest): string {
	const tools = s.tools ? s.tools.join(', ') : 'inherit (parent tool pool)'
	const model = s.model ?? 'inherit'
	return `- ${s.name}: ${s.description} (Tools: ${tools}, Model: ${model})`
}

export function getPrompt(skills: readonly SkillManifest[]): string {
	const listing =
		skills.length > 0
			? `Currently registered skills:\n${skills.map(formatSkillLine).join('\n')}`
			: `No skills are registered in this session.`

	return `Invoke a registered skill (declarative sub-agent template).

${listing}

${WHEN_TO_USE}

${HOW_TO_DISCOVER}

${WHEN_NOT_TO_USE}`
}
