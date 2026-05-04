/**
 * CommandProvider 注入机制单元测试
 *
 * 测试命令提供者注入机制，不测试具体的 DefaultCommandProvider 实现
 * DefaultCommandProvider 是 CLI 侧的实现，其测试应该位于 CLI 侧
 */
import { describe, test, expect, beforeEach } from 'bun:test'
import {
  setCommandProvider,
  getCommandProvider,
  findCommand,
  hasCommand,
  getCommand,
  meetsAvailabilityRequirement,
  formatDescriptionWithSource,
  filterCommandsForRemoteMode,
  isBridgeSafeCommand,
  clearCommandsCache,
  clearCommandMemoizationCaches,
} from '../commands.js'
import type { ICommandProvider } from '../types/commandProvider.js'
import type { Command } from '../types/command.js'

describe('CommandProvider 注入机制', () => {
  beforeEach(() => {
    // 每个测试前清除已注入的 provider
    setCommandProvider(null as unknown as ICommandProvider)
  })

  test('setCommandProvider 和 getCommandProvider 基本功能', () => {
    const mockProvider = {
      getCommands: async () => [],
      getSlashCommandToolSkills: async () => [],
      findCommand: () => undefined,
      hasCommand: () => false,
      getCommand: () => {
        throw new Error('Command not found')
      },
      clearCommandsCache: () => {},
      clearCommandMemoizationCaches: () => {},
      getBuiltInCommandNames: () => new Set(),
      getInternalOnlyCommands: () => [],
      getRemoteSafeCommands: () => new Set(),
      getBridgeSafeCommands: () => new Set(),
      isBridgeSafeCommand: () => false,
      filterCommandsForRemoteMode: () => [],
      formatDescriptionWithSource: () => '',
      meetsAvailabilityRequirement: () => true,
      getStaticCommands: () => [],
    } satisfies ICommandProvider

    setCommandProvider(mockProvider)
    expect(getCommandProvider()).toBe(mockProvider)
  })

  test('getCommandProvider 未设置时返回 null', () => {
    expect(getCommandProvider()).toBeNull()
  })

  test('setCommandProvider 可以覆盖已设置的 provider', () => {
    const provider1 = {
      getCommands: async () => [],
      getSlashCommandToolSkills: async () => [],
      findCommand: () => undefined,
      hasCommand: () => false,
      getCommand: () => {
        throw new Error('Command not found')
      },
      clearCommandsCache: () => {},
      clearCommandMemoizationCaches: () => {},
      getBuiltInCommandNames: () => new Set(),
      getInternalOnlyCommands: () => [],
      getRemoteSafeCommands: () => new Set(),
      getBridgeSafeCommands: () => new Set(),
      isBridgeSafeCommand: () => false,
      filterCommandsForRemoteMode: () => [],
      formatDescriptionWithSource: () => '',
      meetsAvailabilityRequirement: () => true,
      getStaticCommands: () => [],
    } satisfies ICommandProvider

    const provider2 = {
      getCommands: async () => [],
      getSlashCommandToolSkills: async () => [],
      findCommand: () => undefined,
      hasCommand: () => false,
      getCommand: () => {
        throw new Error('Command not found')
      },
      clearCommandsCache: () => {},
      clearCommandMemoizationCaches: () => {},
      getBuiltInCommandNames: () => new Set(),
      getInternalOnlyCommands: () => [],
      getRemoteSafeCommands: () => new Set(),
      getBridgeSafeCommands: () => new Set(),
      isBridgeSafeCommand: () => false,
      filterCommandsForRemoteMode: () => [],
      formatDescriptionWithSource: () => '',
      meetsAvailabilityRequirement: () => true,
      getStaticCommands: () => [],
    } satisfies ICommandProvider

    setCommandProvider(provider1)
    expect(getCommandProvider()).toBe(provider1)

    setCommandProvider(provider2)
    expect(getCommandProvider()).toBe(provider2)
    expect(getCommandProvider()).not.toBe(provider1)
  })
})

describe('框架侧命令工具函数', () => {
  const mockCommands = [
    {
      type: 'prompt',
      name: 'test',
      description: 'Test command',
      source: 'builtin',
    },
    {
      type: 'local',
      name: 'local-cmd',
      description: 'Local command',
      source: 'builtin',
    },
  ] as Command[]

  test('findCommand 查找存在的命令', () => {
    const result = findCommand('test', mockCommands)
    expect(result).toBeDefined()
    expect(result?.name).toBe('test')
  })

  test('findCommand 查找不存在的命令返回 undefined', () => {
    const result = findCommand('nonexistent', mockCommands)
    expect(result).toBeUndefined()
  })

  test('hasCommand 检查命令是否存在', () => {
    expect(hasCommand('test', mockCommands)).toBe(true)
    expect(hasCommand('nonexistent', mockCommands)).toBe(false)
  })

  test('getCommand 获取存在的命令', () => {
    const result = getCommand('test', mockCommands)
    expect(result).toBeDefined()
    expect(result.name).toBe('test')
  })

  test('getCommand 获取不存在的命令抛出错误', () => {
    expect(() => getCommand('nonexistent', mockCommands)).toThrow(
      'Command nonexistent not found',
    )
  })

  test('meetsAvailabilityRequirement 没有 availability 限制时返回 true', () => {
    const mockCommand = {
      type: 'prompt',
      name: 'test',
      description: 'Test command',
      source: 'builtin',
    } as Command

    expect(meetsAvailabilityRequirement(mockCommand)).toBe(true)
  })

  test('formatDescriptionWithSource 格式化 builtin 命令描述', () => {
    const mockCommand = {
      type: 'local',
      name: 'test',
      description: 'Test command',
      source: 'builtin',
    } as unknown as Command

    const result = formatDescriptionWithSource(mockCommand)
    expect(result).toBe('Test command')
  })

  test('filterCommandsForRemoteMode 通过 Provider 过滤', () => {
    // 当没有 Provider 时返回空数组
    const result = filterCommandsForRemoteMode(mockCommands)
    expect(Array.isArray(result)).toBe(true)
  })

  test('isBridgeSafeCommand 通过 Provider 检查', () => {
    // 当没有 Provider 时返回 false
    const mockCommand = {
      type: 'prompt',
      name: 'test',
      description: 'Test command',
      source: 'builtin',
    } as Command

    expect(isBridgeSafeCommand(mockCommand)).toBe(false)
  })

  test('clearCommandsCache 和 clearCommandMemoizationCaches 不抛出错误', () => {
    expect(() => clearCommandsCache()).not.toThrow()
    expect(() => clearCommandMemoizationCaches()).not.toThrow()
  })
})
