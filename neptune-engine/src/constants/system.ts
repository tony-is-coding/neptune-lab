// Critical system constants extracted to break circular dependencies

import {feature} from 'bun:bundle'
import {getFeatureValue_CACHED_MAY_BE_STALE} from '../services/analytics/growthbook.js'
import {logForDebugging} from '../utils/debug.js'
import {isEnvDefinedFalsy} from '../utils/envUtils.js'
import {getAPIProvider} from '../utils/model/providers.js'
import {getWorkload} from '../utils/workloadContext.js'

const DEFAULT_PREFIX = `You are Claude Code, Anthropic's official CLI for Claude.`
const AGENT_SDK_CLAUDE_CODE_PRESET_PREFIX = `You are Claude Code, Anthropic's official CLI for Claude, running within the Claude Agent SDK.`
const AGENT_SDK_PREFIX = `You are a Claude agent, built on Anthropic's Claude Agent SDK.`

const CLI_SYSPROMPT_PREFIX_VALUES = [
	DEFAULT_PREFIX,
	AGENT_SDK_CLAUDE_CODE_PRESET_PREFIX,
	AGENT_SDK_PREFIX,
] as const

export type CLISyspromptPrefix = (typeof CLI_SYSPROMPT_PREFIX_VALUES)[number]

/**
 * All possible CLI sysprompt prefix values, used by splitSysPromptPrefix
 * to identify prefix blocks by content rather than position.
 */
export const CLI_SYSPROMPT_PREFIXES: ReadonlySet<string> = new Set(
	CLI_SYSPROMPT_PREFIX_VALUES,
)

/**
 * 获取系统提示词的身份前缀（Identity Prefix）
 *
 * 这是 LLM 收到的第一句话，定义了 "你是谁"。
 * 例如："You are Claude Code..." 或 "你是财务分析 Agent..."
 *
 * 扩展点设计：
 * - identityOverride 有值时：直接返回它（Agent 场景）
 * - identityOverride 无值时：走 CC 默认逻辑
 *
 * @param options.identityOverride  外部传入的 Agent 身份声明（精确替换 CC 默认身份）
 * @param options.isNonInteractive  是否为非交互模式（SDK/headless）
 * @param options.hasAppendSystemPrompt  是否有追加的系统提示
 */
export function getCLISyspromptPrefix(options?: {
	isNonInteractive: boolean
	hasAppendSystemPrompt: boolean
	identityOverride?: string
}): CLISyspromptPrefix | string {
	// 扩展点：identityOverride 精确替换 CC 身份前缀
	// 场景：Neptune Agent、自定义业务 Agent 等
	if (options?.identityOverride) {
		return options.identityOverride
	}

	const apiProvider = getAPIProvider()
	if (apiProvider === 'vertex') {
		return DEFAULT_PREFIX
	}

	if (options?.isNonInteractive) {
		if (options.hasAppendSystemPrompt) {
			return AGENT_SDK_CLAUDE_CODE_PRESET_PREFIX
		}
		return AGENT_SDK_PREFIX
	}
	return DEFAULT_PREFIX
}

/**
 * Check if attribution header is enabled.
 * Enabled by default, can be disabled via env var or GrowthBook killswitch.
 */
function isAttributionHeaderEnabled(): boolean {
	if (isEnvDefinedFalsy(process.env.CLAUDE_CODE_ATTRIBUTION_HEADER)) {
		return false
	}
	return getFeatureValue_CACHED_MAY_BE_STALE('tengu_attribution_header', true)
}

/**
 * Get attribution header for API requests.
 * Returns a header string with cc_version (including fingerprint) and cc_entrypoint.
 * Enabled by default, can be disabled via env var or GrowthBook killswitch.
 *
 * When NATIVE_CLIENT_ATTESTATION is enabled, includes a `cch=00000` placeholder.
 * Before the request is sent, Bun's native HTTP stack finds this placeholder
 * in the request body and overwrites the zeros with a computed hash. The
 * server verifies this token to confirm the request came from a real Claude
 * Code client. See bun-anthropic/src/http/Attestation.zig for implementation.
 *
 * We use a placeholder (instead of injecting from Zig) because same-length
 * replacement avoids Content-Length changes and buffer reallocation.
 */
export function getAttributionHeader(fingerprint: string): string {
	if (!isAttributionHeaderEnabled()) {
		return ''
	}

	const version = `${MACRO.VERSION}.${fingerprint}`
	const entrypoint = process.env.CLAUDE_CODE_ENTRYPOINT ?? 'unknown'

	// cch=00000 placeholder is overwritten by Bun's HTTP stack with attestation token
	const cch = feature('NATIVE_CLIENT_ATTESTATION') ? ' cch=00000;' : ''
	// cc_workload: turn-scoped hint so the API can route e.g. cron-initiated
	// requests to a lower QoS pool. Absent = interactive default. Safe re:
	// fingerprint (computed from msg chars + version only, line 78 above) and
	// cch attestation (placeholder overwritten in serialized body bytes after
	// this string is built). Server _parse_cc_header tolerates unknown extra
	// fields so old API deploys silently ignore this.
	const workload = getWorkload()
	const workloadPair = workload ? ` cc_workload=${workload};` : ''
	const header = `x-anthropic-billing-header: cc_version=${version}; cc_entrypoint=${entrypoint};${cch}${workloadPair}`

	logForDebugging(`attribution header ${header}`)
	return header
}
