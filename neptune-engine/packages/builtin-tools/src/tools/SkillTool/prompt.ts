import {memoize} from 'lodash-es'
import type {Command} from 'src/commands.js'
import {
	getCommandName,
	getSkillToolCommands,
	getSlashCommandToolSkills,
} from 'src/commands.js'
import {COMMAND_NAME_TAG} from '../../constants/xml.js'
// stringWidth: substrate 用 minimal CJK/emoji-aware 实现，避免依赖 @anthropic/ink。
// cc product 端的 ink 版本可以在 product layer 自定义替换。
const stringWidth = (s: string): number => {
	let width = 0
	for (const ch of s) {
		const code = ch.codePointAt(0) ?? 0
		if (code === 0) continue
		// 控制字符 / 零宽字符跳过
		if (code < 0x20 || (code >= 0x7f && code < 0xa0)) continue
		// CJK / 全角等占两格的字符（粗略范围）
		if (
			(code >= 0x1100 && code <= 0x115f) ||
			(code >= 0x2e80 && code <= 0x303e) ||
			(code >= 0x3041 && code <= 0x33ff) ||
			(code >= 0x3400 && code <= 0x4dbf) ||
			(code >= 0x4e00 && code <= 0x9fff) ||
			(code >= 0xa000 && code <= 0xa4cf) ||
			(code >= 0xac00 && code <= 0xd7a3) ||
			(code >= 0xf900 && code <= 0xfaff) ||
			(code >= 0xff00 && code <= 0xff60) ||
			(code >= 0xffe0 && code <= 0xffe6) ||
			(code >= 0x1f300 && code <= 0x1f64f) ||
			(code >= 0x1f900 && code <= 0x1f9ff) ||
			(code >= 0x20000 && code <= 0x2fffd) ||
			(code >= 0x30000 && code <= 0x3fffd)
		) {
			width += 2
		} else {
			width += 1
		}
	}
	return width
}
import {
	type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
	logEvent,
} from 'src/services/analytics/index.js'
import {count} from '../../utils/array.js'
import {logForDebugging} from '../../utils/cc-shim/log.js'
import {toError} from '../../utils/errors.js'
import {truncate} from '../../utils/truncate.js'
import {logError} from '../../utils/cc-shim/log.js'

// Skill listing gets 1% of the context window (in characters)
export const SKILL_BUDGET_CONTEXT_PERCENT = 0.01
export const CHARS_PER_TOKEN = 4
export const DEFAULT_CHAR_BUDGET = 8_000 // Fallback: 1% of 200k × 4

// Per-entry hard cap. The listing is for discovery only — the Skill tool loads
// full content on invoke, so verbose whenToUse strings waste turn-1 cache_creation
// tokens without improving match rate. Applies to all entries, including bundled,
// since the cap is generous enough to preserve the core use case.
export const MAX_LISTING_DESC_CHARS = 250

export function getCharBudget(contextWindowTokens?: number): number {
	if (Number(process.env.SLASH_COMMAND_TOOL_CHAR_BUDGET)) {
		return Number(process.env.SLASH_COMMAND_TOOL_CHAR_BUDGET)
	}
	if (contextWindowTokens) {
		return Math.floor(
			contextWindowTokens * CHARS_PER_TOKEN * SKILL_BUDGET_CONTEXT_PERCENT,
		)
	}
	return DEFAULT_CHAR_BUDGET
}

function getCommandDescription(cmd: Command): string {
	const desc = cmd.whenToUse
		? `${cmd.description} - ${cmd.whenToUse}`
		: cmd.description
	return desc.length > MAX_LISTING_DESC_CHARS
		? desc.slice(0, MAX_LISTING_DESC_CHARS - 1) + '\u2026'
		: desc
}

function formatCommandDescription(cmd: Command): string {
	// Debug: log if userFacingName differs from cmd.name for plugin skills
	const displayName = getCommandName(cmd)
	if (
		cmd.name !== displayName &&
		cmd.type === 'prompt' &&
		cmd.source === 'plugin'
	) {
		logForDebugging(
			`Skill prompt: showing "${cmd.name}" (userFacingName="${displayName}")`,
		)
	}

	return `- ${cmd.name}: ${getCommandDescription(cmd)}`
}

const MIN_DESC_LENGTH = 20

export function formatCommandsWithinBudget(
	commands: Command[],
	contextWindowTokens?: number,
): string {
	if (commands.length === 0) return ''

	const budget = getCharBudget(contextWindowTokens)

	// Try full descriptions first
	const fullEntries = commands.map(cmd => ({
		cmd,
		full: formatCommandDescription(cmd),
	}))
	// join('\n') produces N-1 newlines for N entries
	const fullTotal =
		fullEntries.reduce((sum, e) => sum + stringWidth(e.full), 0) +
		(fullEntries.length - 1)

	if (fullTotal <= budget) {
		return fullEntries.map(e => e.full).join('\n')
	}

	// Partition into bundled (never truncated) and rest
	const bundledIndices = new Set<number>()
	const restCommands: Command[] = []
	for (let i = 0; i < commands.length; i++) {
		const cmd = commands[i]!
		if (cmd.type === 'prompt' && cmd.source === 'bundled') {
			bundledIndices.add(i)
		} else {
			restCommands.push(cmd)
		}
	}

	// Compute space used by bundled skills (full descriptions, always preserved)
	const bundledChars = fullEntries.reduce(
		(sum, e, i) =>
			bundledIndices.has(i) ? sum + stringWidth(e.full) + 1 : sum,
		0,
	)
	const remainingBudget = budget - bundledChars

	// Calculate max description length for non-bundled commands
	if (restCommands.length === 0) {
		return fullEntries.map(e => e.full).join('\n')
	}

	const restNameOverhead =
		restCommands.reduce((sum, cmd) => sum + stringWidth(cmd.name) + 4, 0) +
		(restCommands.length - 1)
	const availableForDescs = remainingBudget - restNameOverhead
	const maxDescLen = Math.floor(availableForDescs / restCommands.length)

	if (maxDescLen < MIN_DESC_LENGTH) {
		// Extreme case: non-bundled go names-only, bundled keep descriptions
		if (process.env.USER_TYPE === 'ant') {
			logEvent('tengu_skill_descriptions_truncated', {
				skill_count: commands.length,
				budget,
				full_total: fullTotal,
				truncation_mode:
					'names_only' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
				max_desc_length: maxDescLen,
				bundled_count: bundledIndices.size,
				bundled_chars: bundledChars,
			})
		}
		return commands
			.map((cmd, i) =>
				bundledIndices.has(i) ? fullEntries[i]!.full : `- ${cmd.name}`,
			)
			.join('\n')
	}

	// Truncate non-bundled descriptions to fit within budget
	const truncatedCount = count(
		restCommands,
		cmd => stringWidth(getCommandDescription(cmd)) > maxDescLen,
	)
	if (process.env.USER_TYPE === 'ant') {
		logEvent('tengu_skill_descriptions_truncated', {
			skill_count: commands.length,
			budget,
			full_total: fullTotal,
			truncation_mode:
				'description_trimmed' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
			max_desc_length: maxDescLen,
			truncated_count: truncatedCount,
			// Count of bundled skills included in this prompt (excludes skills with disableModelInvocation)
			bundled_count: bundledIndices.size,
			bundled_chars: bundledChars,
		})
	}
	return commands
		.map((cmd, i) => {
			// Bundled skills always get full descriptions
			if (bundledIndices.has(i)) return fullEntries[i]!.full
			const description = getCommandDescription(cmd)
			return `- ${cmd.name}: ${truncate(description, maxDescLen)}`
		})
		.join('\n')
}

export const getPrompt = memoize(async (_cwd: string): Promise<string> => {
	return `Execute a skill within the main conversation

When users ask you to perform tasks, check if any of the available skills match. Skills provide specialized capabilities and domain knowledge.

When users reference a "slash command" or "/<something>" (e.g., "/commit", "/review-pr"), they are referring to a skill. Use this tool to invoke it.

How to invoke:
- Use this tool with the skill name and optional arguments
- Examples:
  - \`skill: "pdf"\` - invoke the pdf skill
  - \`skill: "commit", args: "-m 'Fix bug'"\` - invoke with arguments
  - \`skill: "review-pr", args: "123"\` - invoke with arguments
  - \`skill: "ms-office-suite:pdf"\` - invoke using fully qualified name

Important:
- Available skills are listed in system-reminder messages in the conversation
- When a skill matches the user's request, this is a BLOCKING REQUIREMENT: invoke the relevant Skill tool BEFORE generating any other response about the task
- NEVER mention a skill without actually calling this tool
- Do not invoke a skill that is already running
- Do not use this tool for built-in CLI commands (like /help, /clear, etc.)
- If you see a <${COMMAND_NAME_TAG}> tag in the current conversation turn, the skill has ALREADY been loaded - follow the instructions directly instead of calling this tool again
`
})

export async function getSkillToolInfo(cwd: string): Promise<{
	totalCommands: number
	includedCommands: number
}> {
	const agentCommands = await getSkillToolCommands(cwd)

	return {
		totalCommands: agentCommands.length,
		includedCommands: agentCommands.length,
	}
}

// Returns the commands included in the SkillTool prompt.
// All commands are always included (descriptions may be truncated to fit budget).
// Used by analyzeContext to count skill tokens.
export function getLimitedSkillToolCommands(cwd: string): Promise<Command[]> {
	return getSkillToolCommands(cwd)
}

export function clearPromptCache(): void {
	getPrompt.cache?.clear?.()
}

export async function getSkillInfo(cwd: string): Promise<{
	totalSkills: number
	includedSkills: number
}> {
	try {
		const skills = await getSlashCommandToolSkills(cwd)

		return {
			totalSkills: skills.length,
			includedSkills: skills.length,
		}
	} catch (error) {
		logError(toError(error))

		// Return zeros rather than throwing - let caller decide how to handle
		return {
			totalSkills: 0,
			includedSkills: 0,
		}
	}
}
