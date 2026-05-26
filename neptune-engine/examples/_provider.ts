/**
 * _provider.ts — examples 共享的 provider factory
 *
 * 设计目的（v6.0 P0.1.B）：
 * - 提取三个 example 共用的 provider 选择 + env 解析逻辑
 * - 双模式：
 *   - USE_SCRIPTED_PROVIDER=true → ScriptedProvider（CI 友好，0 API 消耗）
 *   - 否则 → AnthropicStreamingProvider，可指向：
 *     · Anthropic 官方 endpoint（不传 BASE_URL）
 *     · DeepSeek anthropic endpoint（BASE_URL=https://api.deepseek.com/anthropic）
 *     · 任何 anthropic-compatible 第三方
 *
 * env：
 *   USE_SCRIPTED_PROVIDER  - 'true' 走 mock，否则走真 API
 *   API_KEY               - 主认证（优先级最高）
 *   ANTHROPIC_API_KEY     - 兜底（兼容 Anthropic SDK 习惯）
 *   DEEPSEEK_API_KEY      - 当 BASE_URL 含 deepseek 时优先用此 key
 *   BASE_URL              - 自定义 anthropic-compatible endpoint，不设默认走官方
 *   MODEL                 - 模型 ID（必填，substrate 不再硬编码默认）
 */

import {AnthropicStreamingProvider} from '../src/engine/agent-loop/provider/AnthropicStreamingProvider.js'
import type {StreamingProviderAdapter} from '../src/engine/agent-loop/provider/StreamingProviderAdapter.js'
import {
	ScriptedProvider,
	textTurn,
} from '../src/engine/agent-loop/loop/__tests__/scriptedProvider.js'

export interface ResolvedProviderEnv {
	provider: StreamingProviderAdapter
	model: string
	scripted: boolean
}

/**
 * 从 env 决定走哪个 provider，返回 provider 实例 + model。
 *
 * 缺失关键 env 时不抛错，而是 process.exit(1) 并打印清晰的提示——
 * examples 是给人手动跑的，错误信息要直接可读。
 */
export function resolveProvider(): ResolvedProviderEnv {
	const scripted = process.env.USE_SCRIPTED_PROVIDER === 'true'

	if (scripted) {
		// 默认脚本：3 次 turn 都返一段固定文本，足够覆盖 sdk-pure / fs-store / server 三个示例
		const provider = new ScriptedProvider([
			textTurn('Hello from ScriptedProvider — substrate smoke OK'),
			textTurn('Second turn ack'),
			textTurn('Third turn ack'),
		])
		const model = process.env.MODEL || 'scripted-mock'
		return {provider, model, scripted: true}
	}

	// 真 API 模式
	const baseURL = process.env.BASE_URL
	const isDeepSeek = !!baseURL && baseURL.includes('deepseek')

	const apiKey =
		process.env.API_KEY ||
		(isDeepSeek ? process.env.DEEPSEEK_API_KEY : undefined) ||
		process.env.ANTHROPIC_API_KEY

	if (!apiKey) {
		console.error('Set API_KEY (or ANTHROPIC_API_KEY / DEEPSEEK_API_KEY) env var')
		console.error('  - For Anthropic official:  ANTHROPIC_API_KEY=sk-ant-...')
		console.error('  - For DeepSeek anthropic:  DEEPSEEK_API_KEY=... BASE_URL=https://api.deepseek.com/anthropic')
		console.error('  - For mock (no API):       USE_SCRIPTED_PROVIDER=true')
		process.exit(1)
	}

	const model = process.env.MODEL
	if (!model) {
		console.error('Set MODEL env var (substrate does not hardcode default)')
		console.error('  - Anthropic: MODEL=claude-sonnet-4-20250514')
		console.error('  - DeepSeek:  MODEL=deepseek-v4-flash  (or deepseek-v4-pro)')
		process.exit(1)
	}

	const provider = new AnthropicStreamingProvider({
		apiKey,
		...(baseURL && {baseURL}),
		defaultModel: model,
	})
	return {provider, model, scripted: false}
}
