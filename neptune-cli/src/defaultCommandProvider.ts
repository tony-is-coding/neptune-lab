/**
 * CLI 侧的默认命令提供者实现
 *
 * 负责提供 CLI 命令相关的所有功能，包括：
 * - 静态命令列表（67 条 CLI 命令）
 * - 命令集合（INTERNAL_ONLY、REMOTE_SAFE、BRIDGE_SAFE）
 * - 命令查询工具函数
 * - 缓存清理（委托给框架侧，因为 skill/plugin 加载逻辑在框架侧）
 *
 * 对于 skill/plugin 相关的动态命令，通过 ICommandProvider 接口回调框架侧
 */

import type { Command } from 'claude-code-best/types/command.js'
import type { ICommandProvider } from 'claude-code-best/types/commandProvider.js'
import { isClaudeAISubscriber, isUsing3PServices } from 'claude-code-best/utils/auth.js'
import { isFirstPartyAnthropicBaseUrl } from 'claude-code-best/utils/model/providers.js'
import { getSettingSourceName } from 'claude-code-best/utils/settings/constants.js'
import { isCommandEnabled, getCommandName } from 'claude-code-best/types/command.js'
import {
  getSkillDirCommands,
  clearSkillCaches,
} from 'claude-code-best/skills/loadSkillsDir.js'
import { getBundledSkills } from 'claude-code-best/skills/bundledSkills.js'
import { getBuiltinPluginSkillCommands } from 'claude-code-best/plugins/builtinPlugins.js'
import {
  getPluginCommands,
  clearPluginCommandCache,
  getPluginSkills,
  clearPluginSkillsCache,
} from 'claude-code-best/utils/plugins/loadPluginCommands.js'
import memoize from 'lodash-es/memoize.js'
import { feature } from 'bun:bundle'
import { logError } from 'claude-code-best/utils/log.js'
import { toError } from 'claude-code-best/utils/errors.js'
import { logForDebugging } from 'claude-code-best/utils/debug.js'
import {
  COMMANDS,
  builtInCommandNames as getCliBuiltInCommandNames,
  INTERNAL_ONLY_COMMANDS,
  REMOTE_SAFE_COMMANDS,
  BRIDGE_SAFE_COMMANDS,
  findCommand as findCommandInRegistry,
  hasCommand as hasCommandInRegistry,
  getCommand as getCommandFromRegistry,
  isBridgeSafeCommand as isBridgeSafeCommandInRegistry,
  filterCommandsForRemoteMode as filterCommandsForRemoteModeInRegistry,
} from './commandRegistry.js'

/* eslint-disable @typescript-eslint/no-require-imports */
const getWorkflowCommands = feature('WORKFLOW_SCRIPTS')
  ? (
      require('@claude-code-best/builtin-tools/tools/WorkflowTool/createWorkflowCommand.js') as typeof import('@claude-code-best/builtin-tools/tools/WorkflowTool/createWorkflowCommand.js')
    ).getWorkflowCommands
  : null
/* eslint-enable @typescript-eslint/no-require-imports */

/* eslint-disable @typescript-eslint/no-require-imports */
const clearSkillIndexCache = feature('EXPERIMENTAL_SKILL_SEARCH')
  ? (
      require('claude-code-best/services/skillSearch/localSearch.js') as typeof import('claude-code-best/services/skillSearch/localSearch.js')
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
    const bundledSkills = getBundledSkills()
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
 */
function meetsAvailabilityRequirement(cmd: Command): boolean {
  if (!cmd.availability || cmd.availability.length === 0) return true
  for (const a of cmd.availability) {
    switch (a) {
      case 'claude-ai':
        if (isClaudeAISubscriber()) return true
        break
      case 'console':
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
 * Formats a command's description with its source annotation.
 */
function formatDescriptionWithSource(cmd: Command): string {
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
 * Loads all command sources (skills, plugins, workflows, CLI commands).
 * Memoized by cwd because loading is expensive.
 */
const loadAllCommands = memoize(async (cwd: string): Promise<Command[]> => {
  const [
    { skillDirCommands, pluginSkills, bundledSkills, builtinPluginSkills },
    pluginCommands,
    workflowCommands,
  ] = await Promise.all([
    getSkills(cwd),
    getPluginCommands(),
    getWorkflowCommands ? getWorkflowCommands(cwd) : Promise.resolve([]),
  ])

  return [
    ...bundledSkills,
    ...builtinPluginSkills,
    ...skillDirCommands,
    ...(workflowCommands as Command[]),
    ...(pluginCommands as Command[]),
    ...pluginSkills,
    ...COMMANDS(), // CLI 静态命令
  ]
})

/**
 * CLI 侧的默认命令提供者
 *
 * 实现 ICommandProvider 接口，将 CLI 命令注册与框架核心解耦
 */
export class DefaultCommandProvider implements ICommandProvider {
  /**
   * 获取所有可用命令
   * CLI 侧完整实现：合并 skill/plugin + CLI 静态命令
   */
  async getCommands(cwd: string): Promise<Command[]> {
    const allCommands = await loadAllCommands(cwd)
    return allCommands.filter(
      _ => meetsAvailabilityRequirement(_) && isCommandEnabled(_),
    )
  }

  /**
   * 获取可作为技能调用的命令（用于 SkillTool）
   */
  async getSlashCommandToolSkills(cwd: string): Promise<Command[]> {
    const allCommands = await this.getCommands(cwd)
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
  }

  findCommand(commandName: string, commands: Command[]): Command | undefined {
    return commands.find(
      _ =>
        _.name === commandName ||
        getCommandName(_) === commandName ||
        _.aliases?.includes(commandName),
    )
  }

  hasCommand(commandName: string, commands: Command[]): boolean {
    return this.findCommand(commandName, commands) !== undefined
  }

  getCommand(commandName: string, commands: Command[]): Command {
    const command = this.findCommand(commandName, commands)
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
   * 清除所有命令缓存（memoization + skill + plugin）
   */
  clearCommandsCache(): void {
    this.clearCommandMemoizationCaches()
    clearPluginCommandCache()
    clearPluginSkillsCache()
    clearSkillCaches()
  }

  /**
   * 仅清除命令的 memoization 缓存
   */
  clearCommandMemoizationCaches(): void {
    loadAllCommands.cache?.clear?.()
  }

  getBuiltInCommandNames(): Set<string> {
    return getCliBuiltInCommandNames()
  }

  getInternalOnlyCommands(): Command[] {
    return INTERNAL_ONLY_COMMANDS
  }

  getRemoteSafeCommands(): Set<Command> {
    return REMOTE_SAFE_COMMANDS
  }

  getBridgeSafeCommands(): Set<Command> {
    return BRIDGE_SAFE_COMMANDS
  }

  isBridgeSafeCommand(cmd: Command): boolean {
    return isBridgeSafeCommandInRegistry(cmd)
  }

  filterCommandsForRemoteMode(commands: Command[]): Command[] {
    return filterCommandsForRemoteModeInRegistry(commands)
  }

  formatDescriptionWithSource(cmd: Command): string {
    return formatDescriptionWithSource(cmd)
  }

  meetsAvailabilityRequirement(cmd: Command): boolean {
    return meetsAvailabilityRequirement(cmd)
  }

  /**
   * 获取 CLI 静态命令列表（不包括 skill/plugin 动态命令）
   * 用于框架侧加载命令时合并 CLI 命令
   */
  getStaticCommands(): Command[] {
    return COMMANDS()
  }
}
