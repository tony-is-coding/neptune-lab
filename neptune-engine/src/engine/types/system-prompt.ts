/**
 * engine/types/system-prompt.ts — engine 自有定义
 *
 * 从 product 迁入。意图上无任何依赖，可从任何地方 import。
 */

/** 系统提示词的 branded 类型 */
export type SystemPrompt = readonly string[] & {
	readonly __brand: 'SystemPrompt'
}

export function asSystemPrompt(value: readonly string[]): SystemPrompt {
	return value as SystemPrompt
}
