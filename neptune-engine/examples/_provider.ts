/**
 * _provider.ts — examples 共享的 provider factory
 *
 * 设计目的（v6.0 P0.1.B + P0.3）：
 * - 提取三个 example 共用的 provider 选择 + env 解析逻辑
 * - 双模式：
 *   - USE_SCRIPTED_PROVIDER=true → ScriptedProvider（CI 友好，0 API 消耗）
 *   - 否则 → AnthropicStreamingProvider，可指向：
 *     · Anthropic 官方 endpoint（不传 BASE_URL）
 *     · DeepSeek anthropic endpoint（BASE_URL=https://api.deepseek.com/anthropic）
 *     · OpenCode Go anthropic endpoint（BASE_URL=https://opencode.ai/zen/go/v1，需 AUTH_TOKEN）
 *     · 任何 anthropic-compatible 第三方
 *
 * env：
 *   USE_SCRIPTED_PROVIDER  - 'true' 走 mock，否则走真 API
 *   AUTH_TOKEN            - Bearer 认证 token（第三方网关首选，OpenCode Go / Vercel AI Gateway / 等）
 *   API_KEY               - x-api-key 认证（Anthropic 官方风格；优先级低于 AUTH_TOKEN）
 *   ANTHROPIC_AUTH_TOKEN  - AUTH_TOKEN 的兜底 env
 *   ANTHROPIC_API_KEY     - API_KEY 的兜底 env（兼容 Anthropic SDK 习惯）
 *   DEEPSEEK_API_KEY      - 当 BASE_URL 含 deepseek 时优先用此 key
 *   OPENCODE_API_KEY      - 当 BASE_URL 含 opencode 时优先用此 key（作为 AUTH_TOKEN 用）
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
	const isOpenCode = !!baseURL && baseURL.includes('opencode')

	// 认证 token：AUTH_TOKEN（Bearer，第三方网关首选）→ ANTHROPIC_AUTH_TOKEN env → vendor 专属 key
	const authToken =
		process.env.AUTH_TOKEN ||
		process.env.ANTHROPIC_AUTH_TOKEN ||
		(isOpenCode ? process.env.OPENCODE_API_KEY : undefined)

	// API key：API_KEY → ANTHROPIC_API_KEY env → vendor 专属 key
	const apiKey =
		process.env.API_KEY ||
		(isDeepSeek ? process.env.DEEPSEEK_API_KEY : undefined) ||
		process.env.ANTHROPIC_API_KEY

	if (!authToken && !apiKey) {
		console.error('Set one of: AUTH_TOKEN / API_KEY / ANTHROPIC_AUTH_TOKEN / ANTHROPIC_API_KEY / DEEPSEEK_API_KEY / OPENCODE_API_KEY')
		console.error('  - For Anthropic official:    ANTHROPIC_API_KEY=sk-ant-...')
		console.error('  - For DeepSeek anthropic:    DEEPSEEK_API_KEY=... BASE_URL=https://api.deepseek.com/anthropic')
		console.error('  - For OpenCode Go:           OPENCODE_API_KEY=... BASE_URL=https://opencode.ai/zen/go/v1 MODEL=minimax-m2.7')
		console.error('  - For mock (no API):         USE_SCRIPTED_PROVIDER=true')
		process.exit(1)
	}

	const model = process.env.MODEL
	if (!model) {
		console.error('Set MODEL env var (substrate does not hardcode default)')
		console.error('  - Anthropic:     MODEL=claude-sonnet-4-20250514')
		console.error('  - DeepSeek:      MODEL=deepseek-v4-flash  (or deepseek-v4-pro)')
		console.error('  - OpenCode Go:   MODEL=minimax-m2.7  (or qwen3.5-plus / qwen3.6-plus / minimax-m2.5)')
		process.exit(1)
	}

	const provider = new AnthropicStreamingProvider({
		...(authToken && {authToken}),
		...(!authToken && apiKey && {apiKey}),
		...(baseURL && {baseURL}),
		defaultModel: model,
	})
	return {provider, model, scripted: false}
}
