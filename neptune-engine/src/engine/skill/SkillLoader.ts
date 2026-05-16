/**
 * SkillLoader — 将 SkillExtension 写入 workspace/.claude/skills/ 目录
 *
 * Claude Code 的 SkillTool 通过 loadSkillsDir() 扫描 .claude/skills/ 目录发现技能，
 * 而非从 commands 参数读取。本模块将框架层的 SkillExtension 转换为标准 SKILL.md 文件，
 * 使 Claude Code 原生机制自动发现。
 *
 * 覆盖机制：同名 skill 覆盖写入，框架写入的 skill 带 source: engine-extension 标记。
 */

import {mkdirSync, writeFileSync, existsSync, readdirSync, readFileSync, rmSync} from 'fs'
import {join} from 'path'

/** 技能扩展定义 */
export interface SkillExtension {
	name: string           // 技能名称（目录名，如 'budget-analysis'）
	description: string    // 描述
	content: string        // 提示词模板（markdown body）
	whenToUse?: string     // 何时使用
	allowedTools?: string[]
	model?: string
}

/**
 * 将 SkillExtension[] 写入 workspace/.claude/skills/ 目录
 * 格式为 Claude Code 标准的 markdown + frontmatter
 */
export function loadSkillsToWorkspace(skills: SkillExtension[], workspacePath: string): void {
	const skillsDir = join(workspacePath, '.claude', 'skills')

	for (const skill of skills) {
		const skillDir = join(skillsDir, skill.name)
		mkdirSync(skillDir, {recursive: true})

		const frontmatter = buildFrontmatter(skill)
		const fileContent = `${frontmatter}\n\n${skill.content}\n`

		writeFileSync(join(skillDir, 'SKILL.md'), fileContent, 'utf-8')
	}
}

/**
 * 清理框架写入的 skill（通过 source: engine-extension 标记识别）
 * 只删除带有 engine-extension 标记的目录，不影响用户手动创建的 skill
 */
export function cleanupEngineSkills(workspacePath: string): void {
	const skillsDir = join(workspacePath, '.claude', 'skills')
	if (!existsSync(skillsDir)) return

	for (const dir of readdirSync(skillsDir, {withFileTypes: true})) {
		if (!dir.isDirectory()) continue
		const skillFile = join(skillsDir, dir.name, 'SKILL.md')
		if (!existsSync(skillFile)) continue
		const content = readFileSync(skillFile, 'utf-8')
		if (content.includes('source: engine-extension')) {
			rmSync(join(skillsDir, dir.name), {recursive: true})
		}
	}
}

/** 构造 frontmatter 块 */
function buildFrontmatter(skill: SkillExtension): string {
	const lines: string[] = ['---']
	lines.push(`name: ${skill.name}`)
	lines.push(`description: ${skill.description}`)
	lines.push(`source: engine-extension`)
	if (skill.whenToUse) lines.push(`when_to_use: ${skill.whenToUse}`)
	if (skill.allowedTools?.length) {
		lines.push(`allowed-tools:`)
		for (const tool of skill.allowedTools) {
			lines.push(`  - ${tool}`)
		}
	}
	if (skill.model) lines.push(`model: ${skill.model}`)
	lines.push('---')
	return lines.join('\n')
}
