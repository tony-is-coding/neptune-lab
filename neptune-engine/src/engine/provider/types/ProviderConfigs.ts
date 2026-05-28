/**
 * AnthropicProviderConfig — Anthropic API 调用配置
 *
 * 由 AnthropicStreamingProvider 消费（agent-loop 路径）。
 *
 * v6.0 P0.2.C：旧 provider 双轨已一刀切删除（substrate provider/ProviderAdapter
 * + provider/ProviderRegistry + provider/adapters/* + provider/CircuitBreaker），
 * 这里只保留 AnthropicProviderConfig 这一个值类型供 agent-loop 新轨消费。
 *
 * v6.0 P0.3：新增 authToken 字段以支持第三方 anthropic-compatible 网关
 * （OpenCode Go / Vercel AI Gateway / OpenRouter / DeepSeek anthropic / 等）。
 * 这些网关通常用 `Authorization: Bearer <token>` 而非 Anthropic 原生的 `x-api-key`。
 *
 * 认证：apiKey 与 authToken 二选一（同时设置时 authToken 优先，避免两个认证 header）
 * - apiKey: Anthropic 官方认证模式 → SDK emit `x-api-key` header
 * - authToken: 第三方网关 Bearer 模式 → SDK emit `Authorization: Bearer <token>` header
 */
export interface AnthropicProviderConfig {
	/** API Key（Anthropic 官方认证模式；缺失时从 ANTHROPIC_API_KEY env 读取） */
	apiKey?: string
	/**
	 * Auth Token（第三方网关 Bearer 模式；缺失时从 ANTHROPIC_AUTH_TOKEN env 读取）
	 *
	 * 设此字段时 SDK 会用 `Authorization: Bearer <authToken>` 替代 `x-api-key`。
	 * 与 apiKey 同时设置时 authToken 优先（避免两个认证 header 冲突）。
	 *
	 * 用例：
	 * - OpenCode Go：`https://opencode.ai/zen/go/v1` + Bearer
	 * - Vercel AI Gateway：`https://ai-gateway.vercel.sh` + Bearer
	 */
	authToken?: string
	/** Base URL（可选；默认 Anthropic 官方；第三方网关需含 /v1 路径前缀） */
	baseURL?: string
	/** 默认 model（可选，query params.model 优先） */
	defaultModel?: string
	/** Beta flags（可选） */
	betaFlags?: string[]
}
