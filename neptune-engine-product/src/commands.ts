/**
 * 框架核心命令管理模块
 *
 * 职责：
 * 1. 管理 skill/plugin 的加载逻辑（框架核心依赖）
 * 2. 提供 getSkillToolCommands、getSlashCommandToolSkills 等函数给框架核心使用
 * 3. 通过 ICommandProvider 接口从 CLI 获取静态命令列表
 * 4. 导出 Command 类型
 *
 * V9 迁移后：
 * - 所有 CLI 命令导入已移至 CLI 侧 commandRegistry.ts
 * - DefaultCommandProvider 类已移至 CLI 侧
 * - 静态命令集合（INTERNAL_ONLY_COMMANDS 等）从 Provider 获取
 */

import {feature} from 'bun:bundle'
import {logError} from './utils/log.js'
import {toError} from './utils/errors.js'
import {logForDebugging} from './utils/debug.js'
import {
	getSkillDirCommands,
	clearSkillCaches,
	getDynamicSkills,
} from './skills/loadSkillsDir.js'
import {getBundledSkills} from './skills/bundledSkills.js'
import {getBuiltinPluginSkillCommands} from './plugins/builtinPlugins.js'
import {
	getPluginCommands,
	clearPluginCommandCache,
	getPluginSkills,
	clearPluginSkillsCache,
} from './utils/plugins/loadPluginCommands.js'
import memoize from 'lodash-es/memoize.js'
import {isUsing3PServices, isClaudeAISubscriber} from './utils/auth.js'
import {isFirstPartyAnthropicBaseUrl} from './utils/model/providers.js'
import {getSettingSourceName} from './utils/settings/constants.js'
import {
	type Command,
	getCommandName,
	isCommandEnabled,
} from './types/command.js'
import type {ICommandProvider} from './types/commandProvider.js'

// Re-export types from the centralized location
export type {
	Command,
	CommandBase,
	CommandResultDisplay,
	LocalCommandResult,
	LocalJSXCommandContext,
	PromptCommand,
	ResumeEntrypoint,
} from './types/command.js'
export {getCommandName, isCommandEnabled} from './types/command.js'

/* eslint-disable @typescript-eslint/no-require-imports */
const getWorkflowCommands = feature('WORKFLOW_SCRIPTS')
	? (
		require('./product-tools/workflow/createWorkflowCommand.js') as typeof import('./product-tools/workflow/createWorkflowCommand.js')
	).getWorkflowCommands
	: null
/* eslint-enable @typescript-eslint/no-require-imports */

/* eslint-disable @typescript-eslint/no-require-imports */
const clearSkillIndexCache = feature('EXPERIMENTAL_SKILL_SEARCH')
	? (
		require('./services/skillSearch/localSearch.js') as typeof import('./services/skillSearch/localSearch.js')
	).clearSkillIndexCache
	: null

/* eslint-enable @typescript-eslint/no-require-imports */

async function getSkills(cwd: string): Promise<{
	skillDirCommands: Command[]
	pluginSkills: Command[]
	bundledSkills: Command[]
	builtinPluginSkills: Command[]
}> {
	try {
		const [skillDirCommands, pluginSkills] = await Promise.all([
			getSkillDirCommands(cwd).catch(err => {
				logError(toError(err))
				logForDebugging(
					'Skill directory commands failed to load, continuing without them',
				)
				return []
			}),
			getPluginSkills().catch(err => {
				logError(toError(err))
				logForDebugging('Plugin skills failed to load, continuing without them')
				return []
			}),
		])
		// Bundled skills are registered synchronously at startup
		const bundledSkills = getBundledSkills()
		// Built-in plugin skills come from enabled built-in plugins
		const builtinPluginSkills = getBuiltinPluginSkillCommands()
		logForDebugging(
			`getSkills returning: ${skillDirCommands.length} skill dir commands, ${pluginSkills.length} plugin skills, ${bundledSkills.length} bundled skills, ${builtinPluginSkills.length} builtin plugin skills`,
		)
		return {
			skillDirCommands,
			pluginSkills,
			bundledSkills,
			builtinPluginSkills,
		}
	} catch (err) {
		// This should never happen since we catch at the Promise level, but defensive
		logError(toError(err))
		logForDebugging('Unexpected error in getSkills, returning empty')
		return {
			skillDirCommands: [],
			pluginSkills: [],
			bundledSkills: [],
			builtinPluginSkills: [],
		}
	}
}

/**
 * Filters commands by their declared `availability` (auth/provider requirement).
 * Commands without `availability` are treated as universal.
 * This runs before `isEnabled()` so that provider-gated commands are hidden
 * regardless of feature-flag state.
 *
 * Not memoized — auth state can change mid-session (e.g. after /login),
 * so this must be re-evaluated on every getCommands() call.
 */
export function meetsAvailabilityRequirement(cmd: Command): boolean {
	if (!cmd.availability || cmd.availability.length === 0) return true
	for (const a of cmd.availability) {
		switch (a) {
			case 'claude-ai':
				if (isClaudeAISubscriber()) return true
				break
			case 'console':
				// Console API key user = direct 1P API customer (not 3P, not claude.ai).
				// Excludes 3P (Bedrock/Vertex/Foundry) who don't set ANTHROPIC_BASE_URL
				// and gateway users who proxy through a custom base URL.
				if (
					!isClaudeAISubscriber() &&
					!isUsing3PServices() &&
					isFirstPartyAnthropicBaseUrl()
				)
					return true
				break
			default: {
				const _exhaustive: never = a
				void _exhaustive
				break
			}
		}
	}
	return false
}

/**
 * 从 CLI 注入的 Provider 获取静态命令列表
 */
async function getCliCommandsFromProvider(): Promise<Command[]> {
	const provider = getCommandProvider()
	if (provider) {
		return provider.getStaticCommands()
	}
	return []
}

/**
 * Loads all command sources (skills, plugins, workflows). Memoized by cwd
 * because loading is expensive (disk I/O, dynamic imports).
 */
const loadAllCommands = memoize(async (cwd: string): Promise<Command[]> => {
	const [
		{skillDirCommands, pluginSkills, bundledSkills, builtinPluginSkills},
		pluginCommands,
		workflowCommands,
	] = await Promise.all([
		getSkills(cwd),
		getPluginCommands(),
		getWorkflowCommands ? getWorkflowCommands(cwd) : Promise.resolve([]),
	])

	// 从 CLI 侧获取静态命令列表
	// 注意：这里不能调用 provider.getCommands()，因为那会递归回这里
	// 我们需要一个不同的方法来获取 CLI 的静态命令
	const cliCommands = await getCliCommandsFromProvider()

	return [
		...bundledSkills,
		...builtinPluginSkills,
		...skillDirCommands,
		...(workflowCommands as Command[]),
		...(pluginCommands as Command[]),
		...pluginSkills,
		...cliCommands,
	]
})

/**
 * Returns commands available to the current user. The expensive loading is
 * memoized, but availability and isEnabled checks run fresh every call so
 * auth changes (e.g. /login) take effect immediately.
 */
export async function getCommands(cwd: string): Promise<Command[]> {
	const allCommands = await loadAllCommands(cwd)

	// Get dynamic skills discovered during file operations
	const dynamicSkills = getDynamicSkills()

	// Build base commands without dynamic skills
	const baseCommands = allCommands.filter(
		_ => meetsAvailabilityRequirement(_) && isCommandEnabled(_),
	)

	if (dynamicSkills.length === 0) {
		return baseCommands
	}

	// Dedupe dynamic skills - only add if not already present
	const baseCommandNames = new Set(baseCommands.map(c => c.name))
	const uniqueDynamicSkills = dynamicSkills.filter(
		s =>
			!baseCommandNames.has(s.name) &&
			meetsAvailabilityRequirement(s) &&
			isCommandEnabled(s),
	)

	if (uniqueDynamicSkills.length === 0) {
		return baseCommands
	}

	// Insert dynamic skills after plugin skills but before built-in commands
	const provider = getCommandProvider()
	const builtInNames = provider ? provider.getBuiltInCommandNames() : new Set()
	const insertIndex = baseCommands.findIndex(c => builtInNames.has(c.name))

	if (insertIndex === -1) {
		return [...baseCommands, ...uniqueDynamicSkills]
	}

	return [
		...baseCommands.slice(0, insertIndex),
		...uniqueDynamicSkills,
		...baseCommands.slice(insertIndex),
	]
}

/**
 * Clears only the memoization caches for commands, WITHOUT clearing skill caches.
 * Use this when dynamic skills are added to invalidate cached command lists.
 */
export function clearCommandMemoizationCaches(): void {
	loadAllCommands.cache?.clear?.()
	getSkillToolCommands.cache?.clear?.()
	getSlashCommandToolSkills.cache?.clear?.()
	// getSkillIndex in skillSearch/localSearch.ts is a separate memoization layer
	// built ON TOP of getSkillToolCommands/getCommands. Clearing only the inner
	// caches is a no-op for the outer — lodash memoize returns the cached result
	// without ever reaching the cleared inners. Must clear it explicitly.
	clearSkillIndexCache?.()
}

export function clearCommandsCache(): void {
	clearCommandMemoizationCaches()
	clearPluginCommandCache()
	clearPluginSkillsCache()
	clearSkillCaches()
}

/**
 * Filter AppState.mcp.commands to MCP-provided skills (prompt-type,
 * model-invocable, loaded from MCP). These live outside getCommands() so
 * callers that need MCP skills in their skill index thread them through
 * separately.
 */
export function getMcpSkillCommands(
	mcpCommands: readonly Command[],
): readonly Command[] {
	if (feature('MCP_SKILLS')) {
		return mcpCommands.filter(
			cmd =>
				cmd.type === 'prompt' &&
				cmd.loadedFrom === 'mcp' &&
				!cmd.disableModelInvocation,
		)
	}
	return []
}

// SkillTool shows ALL prompt-based commands that the model can invoke
// This includes both skills (from /skills/) and commands (from /commands/)
export const getSkillToolCommands = memoize(
	async (cwd: string): Promise<Command[]> => {
		const allCommands = await getCommands(cwd)
		return allCommands.filter(
			cmd =>
				cmd.type === 'prompt' &&
				!cmd.disableModelInvocation &&
				cmd.source !== 'builtin' &&
				// Always include skills from /skills/ dirs, bundled skills, and legacy /commands/ entries
				// (they all get an auto-derived description from the first line if frontmatter is missing).
				// Plugin/MCP commands still require an explicit description to appear in the listing.
				(cmd.loadedFrom === 'bundled' ||
					cmd.loadedFrom === 'skills' ||
					cmd.loadedFrom === 'commands_DEPRECATED' ||
					cmd.hasUserSpecifiedDescription ||
					cmd.whenToUse),
		)
	},
)

// Filters commands to include only skills. Skills are commands that provide
// specialized capabilities for the model to use. They are identified by
// loadedFrom being 'skills', 'plugin', or 'bundled', or having disableModelInvocation set.
export const getSlashCommandToolSkills = memoize(
	async (cwd: string): Promise<Command[]> => {
		try {
			const allCommands = await getCommands(cwd)
			return allCommands.filter(
				cmd =>
					cmd.type === 'prompt' &&
					cmd.source !== 'builtin' &&
					(cmd.hasUserSpecifiedDescription || cmd.whenToUse) &&
					(cmd.loadedFrom === 'skills' ||
						cmd.loadedFrom === 'plugin' ||
						cmd.loadedFrom === 'bundled' ||
						cmd.disableModelInvocation),
			)
		} catch (error) {
			logError(toError(error))
			// Return empty array rather than throwing - skills are non-critical
			// This prevents skill loading failures from breaking the entire system
			logForDebugging('Returning empty skills array due to load failure')
			return []
		}
	},
)

/**
 * 查找指定名称的命令
 */
export function findCommand(
	commandName: string,
	commands: Command[],
): Command | undefined {
	return commands.find(
		_ =>
			_.name === commandName ||
			getCommandName(_) === commandName ||
			_.aliases?.includes(commandName),
	)
}

/**
 * 检查是否有指定命令
 */
export function hasCommand(commandName: string, commands: Command[]): boolean {
	return findCommand(commandName, commands) !== undefined
}

/**
 * 获取指定命令（不存在时抛出错误）
 */
export function getCommand(commandName: string, commands: Command[]): Command {
	const command = findCommand(commandName, commands)
	if (!command) {
		throw ReferenceError(
			`Command ${commandName} not found. Available commands: ${commands
				.map(_ => {
					const name = getCommandName(_)
					return _.aliases ? `${name} (aliases: ${_.aliases.join(', ')})` : name
				})
				.sort((a, b) => a.localeCompare(b))
				.join(', ')}`,
		)
	}

	return command
}

/**
 * 获取所有内置命令名称（从 Provider 获取）
 */
export function builtInCommandNames(): Set<string> {
	const provider = getCommandProvider()
	return provider ? provider.getBuiltInCommandNames() : new Set()
}

/**
 * Formats a command's description with its source annotation for user-facing UI.
 * Use this in typeahead, help screens, and other places where users need to see
 * where a command comes from.
 *
 * For model-facing prompts (like SkillTool), use cmd.description directly.
 */
export function formatDescriptionWithSource(cmd: Command): string {
	if (cmd.type !== 'prompt') {
		return cmd.description
	}

	if (cmd.kind === 'workflow') {
		return `${cmd.description} (workflow)`
	}

	if (cmd.source === 'plugin') {
		const pluginName = cmd.pluginInfo?.pluginManifest.name
		if (pluginName) {
			return `(${pluginName}) ${cmd.description}`
		}
		return `${cmd.description} (plugin)`
	}

	if (cmd.source === 'builtin' || cmd.source === 'mcp') {
		return cmd.description
	}

	if (cmd.source === 'bundled') {
		return `${cmd.description} (bundled)`
	}

	return `${cmd.description} (${getSettingSourceName(cmd.source)})`
}

/**
 * 检查命令是否在 Bridge 模式下安全（从 Provider 获取）
 */
export function isBridgeSafeCommand(cmd: Command): boolean {
	const provider = getCommandProvider()
	return provider ? provider.isBridgeSafeCommand(cmd) : false
}

/**
 * 过滤远程模式下的命令（从 Provider 获取）
 */
export function filterCommandsForRemoteMode(commands: Command[]): Command[] {
	const provider = getCommandProvider()
	return provider ? provider.filterCommandsForRemoteMode(commands) : []
}

// 命令提供者注入机制
let _commandProvider: ICommandProvider | null = null

/**
 * 设置命令提供者实例
 * CLI 宿主在启动时调用此函数注入 DefaultCommandProvider
 */
export function setCommandProvider(provider: ICommandProvider): void {
	_commandProvider = provider
}

/**
 * 获取已注入的命令提供者实例
 * 框架核心通过此函数获取 CLI 注入的命令提供者
 */
export function getCommandProvider(): ICommandProvider | null {
	return _commandProvider
}

/**
 * 导出 Provider 接口供 CLI 侧实现
 */
export type {ICommandProvider} from './types/commandProvider.js'
