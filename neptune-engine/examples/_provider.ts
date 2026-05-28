/**
 * _provider.ts — 共享 provider factory（substrate-agnostic 配置抽象）
 *
 * ════════════════════════════════════════════════════════════════════════
 * 设计原则（第一性原理）
 * ════════════════════════════════════════════════════════════════════════
 *
 * SDK example 不应该感知任何 vendor 知识（DeepSeek / OpenCode Go /
 * Anthropic / etc.）。Vendor 知识 = 配置（env），不是代码。
 *
 * 用户接入 anthropic-compatible LLM provider 真正需要的 3 类正交配置：
 *
 *   1. 认证值     = API_KEY / AUTH_TOKEN
 *   2. 认证模式   = x-api-key (Anthropic 原生) | Authorization Bearer (网关惯例)
 *   3. 端点 + 模型 = BASE_URL + MODEL
 *
 * 只要这 3 类配置正确，substrate 可与任意 anthropic-compatible 端点对接。
 *
 * ════════════════════════════════════════════════════════════════════════
 * Provider 路由全景图
 * ════════════════════════════════════════════════════════════════════════
 *
 *                            user-supplied env
 *                                    │
 *                                    ▼
 *  ┌───────────────────────────────────────────────────────────────────┐
 *  │                    resolveProvider() (this file)                  │
 *  │                                                                   │
 *  │  ┌──────────────────────────┐    ┌────────────────────────────┐   │
 *  │  │ USE_SCRIPTED_PROVIDER=1? │───▶│ ScriptedProvider (mock)    │   │
 *  │  └─────────┬────────────────┘    │  - 0 API 消耗，CI 友好     │   │
 *  │            │ no                  │  - 预设 SSE 流，确定性     │   │
 *  │            ▼                     └────────────────────────────┘   │
 *  │  ┌──────────────────────────────────────────────────────────────┐ │
 *  │  │ AnthropicStreamingProvider (真 API)                          │ │
 *  │  │                                                              │ │
 *  │  │  config from env:                                            │ │
 *  │  │    apiKey    ◀── API_KEY | ANTHROPIC_API_KEY                 │ │
 *  │  │    authToken ◀── AUTH_TOKEN | ANTHROPIC_AUTH_TOKEN           │ │
 *  │  │    baseURL   ◀── BASE_URL | ANTHROPIC_BASE_URL               │ │
 *  │  │    model     ◀── MODEL                                       │ │
 *  │  │                                                              │ │
 *  │  │  AUTH_MODE 决定使用 apiKey 还是 authToken：                  │ │
 *  │  │    apikey (默认) → x-api-key header                          │ │
 *  │  │    bearer        → Authorization: Bearer header              │ │
 *  │  │  (若两者都设了，AUTH_MODE 决定哪个生效，避免双 header)       │ │
 *  │  └──────────────────────────────────────────────────────────────┘ │
 *  └───────────────────────────────────────────────────────────────────┘
 *                                    │
 *                                    ▼
 *                    StreamingProviderAdapter 实例
 *                    (substrate AgentLoop 消费，不关心来源)
 *
 * ════════════════════════════════════════════════════════════════════════
 * 配置场景示例（仅注释，代码完全 vendor-agnostic）
 * ════════════════════════════════════════════════════════════════════════
 *
 *   Anthropic 官方:
 *     AUTH_MODE=apikey
 *     API_KEY=<api-key>
 *     # BASE_URL 不设 → 默认 https://api.anthropic.com
 *     MODEL=claude-sonnet-4-20250514
 *
 *   DeepSeek 官方 anthropic endpoint:
 *     AUTH_MODE=apikey
 *     API_KEY=<api-key>
 *     BASE_URL=https://api.deepseek.com/anthropic
 *     MODEL=deepseek-v4-flash
 *
 *   OpenCode Go via cc-switch 本地代理:
 *     AUTH_MODE=apikey
 *     API_KEY=<api-key>
 *     BASE_URL=http://127.0.0.1:15721
 *     MODEL=deepseek-v4-flash
 *
 *   Vercel AI Gateway 等 Bearer 网关:
 *     AUTH_MODE=bearer
 *     AUTH_TOKEN=xxx
 *     BASE_URL=https://ai-gateway.vercel.sh
 *     MODEL=anthropic/claude-sonnet-4-5
 *
 *   离线 mock（CI 用）:
 *     USE_SCRIPTED_PROVIDER=true
 *     # 其他 env 不需要
 *
 *   复用 cc-switch / claude code 已注入的 env（0 改动接入）:
 *     # cc-switch 自动注入 ANTHROPIC_AUTH_TOKEN / ANTHROPIC_BASE_URL
 *     # 仅需补 MODEL 即可
 *     AUTH_MODE=bearer
 *     MODEL=deepseek-v4-flash
 *     bun run examples/sdk-pure.ts
 *
 * ════════════════════════════════════════════════════════════════════════
 */

import {AnthropicStreamingProvider} from '../src/engine/agent-loop/provider/AnthropicStreamingProvider.js'
import type {StreamingProviderAdapter} from '../src/engine/agent-loop/provider/StreamingProviderAdapter.js'
import {ScriptedProvider, textTurn} from '../src/testing.js'

export interface ResolvedProviderEnv {
	provider: StreamingProviderAdapter
	model: string
	scripted: boolean
}

/** 读 env，缺失时返 undefined。空字符串视为未设置。 */
function envOr(...keys: string[]): string | undefined {
	for (const k of keys) {
		const v = process.env[k]
		if (v !== undefined && v.length > 0) return v
	}
	return undefined
}

/**
 * 从 env 解析出 substrate StreamingProvider。
 *
 * 缺失关键 env 时打印清晰提示并 process.exit(1)——examples 是给人手动跑的，
 * 错误信息要直接可读。
 */
export function resolveProvider(): ResolvedProviderEnv {
	// 1) Mock 模式（CI 友好，0 API 消耗）
	if (process.env.USE_SCRIPTED_PROVIDER === 'true') {
		const provider = new ScriptedProvider([
			textTurn('Hello from ScriptedProvider — substrate smoke OK'),
			textTurn('Second turn ack'),
			textTurn('Third turn ack'),
		])
		return {provider, model: process.env.MODEL || 'scripted-mock', scripted: true}
	}

	// 2) 真 API 模式：3 类正交配置
	const authMode = (process.env.AUTH_MODE || 'apikey').toLowerCase()
	const apiKey = envOr('API_KEY', 'ANTHROPIC_API_KEY')
	const authToken = envOr('AUTH_TOKEN', 'ANTHROPIC_AUTH_TOKEN')
	const baseURL = envOr('BASE_URL', 'ANTHROPIC_BASE_URL')
	const model = envOr('MODEL')

	// 校验：认证至少一个
	const useBearer = authMode === 'bearer'
	const credential = useBearer ? authToken : apiKey
	if (!credential) {
		const expectedKey = useBearer
			? 'AUTH_TOKEN (or ANTHROPIC_AUTH_TOKEN)'
			: 'API_KEY (or ANTHROPIC_API_KEY)'
		console.error(`Missing credential for AUTH_MODE=${authMode}: set ${expectedKey}`)
		console.error('')
		console.error('Three orthogonal env to configure any anthropic-compatible provider:')
		console.error('  AUTH_MODE=apikey|bearer  (default: apikey)')
		console.error('  API_KEY=... or AUTH_TOKEN=...')
		console.error('  BASE_URL=...             (optional, defaults to Anthropic)')
		console.error('  MODEL=...                (required)')
		console.error('')
		console.error('Or use mock for CI:  USE_SCRIPTED_PROVIDER=true')
		process.exit(1)
	}

	// 校验：model 必填
	if (!model) {
		console.error('Set MODEL env var (substrate does not hardcode default)')
		process.exit(1)
	}

	const provider = new AnthropicStreamingProvider({
		// authToken 与 apiKey 由 substrate 内部根据互斥优先级处理；
		// 这里按 AUTH_MODE 单向注入，避免歧义。
		...(useBearer ? {authToken: credential} : {apiKey: credential}),
		...(baseURL && {baseURL}),
		defaultModel: model,
	})
	return {provider, model, scripted: false}
}
