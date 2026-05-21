/**
 * engine/types/system-prompt.ts
 *
 * SystemPrompt 类型屏障文件
 *
 * 重新导出 src/utils/systemPromptType.ts 的核心类型，避免 engine/ 向外穿透到 src/。
 *
 * @module
 */

// 重新导出 SystemPrompt 相关类型
export type {SystemPrompt} from '../../utils/systemPromptType.js'
export {asSystemPrompt} from '../../utils/systemPromptType.js'
