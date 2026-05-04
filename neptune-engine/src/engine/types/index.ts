/**
 * engine/types/index.ts - 统一导出 engine/types/ 下的所有类型
 *
 * 此文件作为 engine/ 内部的类型声明中心，避免从 engine/ 向外穿透到 src/types/
 * engine/ 内的文件应该从这里导入类型，而不是直接从 src/types/ 导入
 *
 * V18 优化：新增 6 个屏障文件，消除 type import 穿透
 * - tool.ts ← src/Tool.ts
 * - fileHistory.ts ← src/utils/fileHistory.ts
 * - attribution.ts ← src/utils/commitAttribution.ts
 * - model.ts ← src/utils/model/model.ts
 * - mcp.ts ← src/services/mcp/types.ts
 * - sessionHooks.ts ← src/utils/hooks/sessionHooks.ts
 *
 * V19 优化：新增 3 个屏障文件
 * - query-engine.ts ← src/QueryEngine.ts
 * - system-prompt.ts ← src/utils/systemPromptType.ts
 * - settings.ts ← src/utils/settings/types.ts
 */

// 重新导出所有类型文件
export * from './ids.js'
export * from './command.js'
export * from './message.js'
export * from './plugin.js'
export * from './permissions.js'
export * from './CoreAppState.js'
export * from './query-events.js'

// V18 新增：屏障文件（消除 type import 穿透）
export * from './tool.js'
export * from './fileHistory.js'
export * from './attribution.js'
export * from './model.js'
export * from './mcp.js'
export * from './sessionHooks.js'
export * from './engine-events.js'

// V19 新增：屏障文件（消除 type import 穿透）
export * from './query-engine.js'
export * from './system-prompt.js'
export * from './settings.js'
export * from './tool-extension.js'
