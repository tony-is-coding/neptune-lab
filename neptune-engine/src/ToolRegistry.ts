/**
 * ToolRegistry 接口 - 工具注册表
 *
 * @planned V19 启用计划
 *
 * 定义工具注册和获取的统一接口，支持可插拔的工具管理。
 * SDK 模式和 CLI 模式可以使用不同的实现。
 *
 * **V19 启用计划**：
 * 1. 在 AgentEngine 中集成 ToolRegistry 接口
 * 2. 支持动态注册工具（运行时添加新工具）
 * 3. 提供工具热加载/热卸载能力
 * 4. 添加工具生命周期管理（初始化、清理）
 * 5. 与 Skill 扩展系统集成
 *
 * **当前状态**：接口定义完成，DefaultToolRegistry 实现完整
 * **使用方式**：通过 EngineConfig.toolRegistryInstance 注入
 */

import type { Tool } from './Tool.js'
import type { ToolPermissionContext } from './types/permissions.js'

/**
 * 工具集合定义
 */
export type ToolSet = {
  /** 工具列表 */
  tools: Tool[]
  /** 工具集合名称（用于标识） */
  name?: string
  /** 是否启用 */
  enabled?: boolean
}

/**
 * ToolRegistry 接口
 *
 * 提供工具注册、获取和过滤功能。
 */
export interface ToolRegistry {
  /**
   * 注册工具集合
   * @param toolSet 工具集合
   */
  registerToolSet(toolSet: ToolSet): void

  /**
   * 获取所有工具列表
   * @param permissionContext 权限上下文
   * @returns 工具列表
   */
  getTools(permissionContext: ToolPermissionContext): Tool[]

  /**
   * 根据名称获取工具
   * @param name 工具名称
   * @returns 工具实例或 undefined
   */
  getToolByName(name: string): Tool | undefined

  /**
   * 过滤工具列表
   * @param filterFn 过滤函数
   * @returns 过滤后的工具列表
   */
  filterTools(filterFn: (tool: Tool) => boolean): Tool[]

  /**
   * 获取核心工具数量（用于验证）
   * @returns 核心工具数量
   */
  getCoreToolCount(): number
}
