/**
 * engine/provider/ 公共 API 导出
 *
 * 旧 provider 双轨（ProviderAdapter / BaseProvider / ProviderRegistry / CircuitBreaker）
 * 已于 v6.0 P0.2.C 一刀切删除。substrate 唯一查询路径是 agent-loop:
 *   AgentEngine.query → AgentLoop.runWithStore + AgentLoopBridge → SDK QueryEvent
 * 实际 LLM 调用走 src/engine/agent-loop/provider/AnthropicStreamingProvider.ts
 */

export type {AnthropicProviderConfig} from './types/ProviderConfigs.js'
