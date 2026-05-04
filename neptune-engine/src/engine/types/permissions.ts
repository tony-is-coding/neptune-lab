/**
 * engine/types/permissions.ts - 重新导出 src/types/permissions.ts 的类型
 *
 * 此文件作为 engine/ 内部的类型声明层，避免从 engine/ 向外穿透到 src/types/
 * engine/ 内的文件应该从这里导入类型，而不是直接从 src/types/ 导入
 */

// 导入 CanUseToolFn 所需的类型
import type { Tool, ToolUseContext } from '../../Tool.js'
import type { AssistantMessage } from './message.js'

// 重新导出权限模式常量
export {
  EXTERNAL_PERMISSION_MODES,
  INTERNAL_PERMISSION_MODES,
  PERMISSION_MODES,
} from '../../types/permissions.js'

// 重新导出权限类型
export type {
  ExternalPermissionMode,
  InternalPermissionMode,
  PermissionMode,
  PermissionBehavior,
  PermissionRuleSource,
  PermissionRuleValue,
  PermissionRule,
  PermissionUpdateDestination,
  PermissionUpdate,
  WorkingDirectorySource,
  AdditionalWorkingDirectory,
  PermissionCommandMetadata,
  PermissionMetadata,
  PermissionAllowDecision,
  PendingClassifierCheck,
  PermissionAskDecision,
  PermissionDenyDecision,
  PermissionDecision,
  PermissionResult,
  PermissionDecisionReason,
  ClassifierResult,
  ClassifierBehavior,
  ClassifierUsage,
  YoloClassifierResult,
  RiskLevel,
  PermissionExplanation,
  ToolPermissionRulesBySource,
  CanUseToolFn,
  ToolPermissionContext,
} from '../../types/permissions.js'
