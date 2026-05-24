/**
 * cc-shim/permissions/index.ts — substrate-local 替代 src/utils/permissions/* 系列
 *
 * 设计：engine `types/permissions.ts` 已含全部 substrate 必要类型
 * （PermissionResult / PermissionDecision / PermissionUpdate / PendingClassifierCheck 等）。
 * 这里只做"路径重定向" — re-export engine 的类型，让 builtin-tools 工具改 import 路径即可。
 *
 * 业务函数（createPermissionRequestMessage / extractRules / allWorkingDirectories /
 *  shellRuleMatching / bashClassifier / 等）按如下策略：
 * - 通用纯函数 → 内联 substrate 简化版
 * - cc 业务（含 LLM-driven / cc 状态全局）→ stub 让 bashPermissions 仍能编译，运行时退化为保守 allow/deny
 *
 * Product 层若需还原完整 cc 行为，自己注入 BashSecurity 接口 override（S2 PolicyHook 范畴）。
 */

// 类型 re-export 自 engine
export type {
	PermissionResult,
	PermissionDecision,
	PermissionAllowDecision,
	PermissionAskDecision,
	PermissionDenyDecision,
	PermissionDecisionReason,
	PermissionMetadata,
	PermissionUpdate,
	PermissionUpdateDestination,
	PermissionRule,
	PermissionRuleValue,
	PermissionRuleSource,
	PermissionMode,
	PendingClassifierCheck,
} from '@neptune/engine/types/permissions.js'

// PermissionResult helper（cc 原有于 PermissionResult.ts；纯函数）
export function getRuleBehaviorDescription(behavior: 'allow' | 'deny' | 'ask'): string {
	switch (behavior) {
		case 'allow':
			return 'allowed'
		case 'deny':
			return 'denied'
		case 'ask':
			return 'will ask'
	}
}

// shellRuleMatching stub:
// substrate 不感知 cc 的 shell rule 结构（基于规则集 + LLM prefix 的复杂业务）。
// product 想用完整规则集，自己注入。这里 stub 总返 'no rules' 让 bashPermissions 走
// fallback ask-user 路径。
export function getMatchingShellRules(
	_command: string,
	_rules: unknown,
): {matchingRules: unknown[]; matchedAllowRule: unknown | null; matchedDenyRule: unknown | null} {
	return {matchingRules: [], matchedAllowRule: null, matchedDenyRule: null}
}

// filesystem helpers — substrate 简化版
import {homedir, tmpdir} from 'os'
import {resolve as pathResolve} from 'path'

export function allWorkingDirectories(_ctx: unknown): string[] {
	// substrate 不维护 cwdState，返回 process.cwd() 单值
	return [process.cwd()]
}

export function getClaudeTempDir(): string {
	return tmpdir()
}

export function getDirectoryWithinHome(rel: string): string {
	return pathResolve(homedir(), rel)
}

// PermissionUpdate / PermissionUpdateSchema stubs
export function extractRules(_update: unknown): unknown[] {
	return []
}

export function createReadRuleSuggestion(_path: string): unknown {
	return null
}

// permissions.ts (cc product 主入口) stub
export function createPermissionRequestMessage(
	tool: {name: string},
	_input: unknown,
	_context?: unknown,
): unknown {
	return {
		type: 'permission_request',
		toolName: tool.name,
		message: `Permission required for ${tool.name}`,
	}
}

// bashClassifier stub
export function classifyBashCommand(_command: string): {
	classification: 'safe' | 'unsafe' | 'unknown'
} {
	return {classification: 'unknown'}
}


// PermissionMode schema (cc 用 zod；substrate 简化为运行时 string union)
import {z} from 'zod/v4'
export const permissionModeSchema = z.enum(['default', 'plan', 'readonly', 'dangerous', 'bypass', 'auto'])

// permissionRuleParser stubs（builtin-tools 工具 fallback；总返保守值）
export function permissionRuleValueFromString(_s: string): unknown {
	return null
}
export function permissionRuleValueToString(_v: unknown): string {
	return ''
}

// yoloClassifier stub（cc 业务）
export function isYoloRule(_rule: unknown): boolean {
	return false
}
export function classifyYoloRisk(_rule: unknown): 'safe' | 'risky' | 'dangerous' {
	return 'safe'
}

// PermissionRule type re-export（已在前面 export 了 PermissionRule）

// pathValidation utilities — substrate 简化版
import {isAbsolute as pathIsAbsolute, normalize as pathNormalize, resolve as pathResolveFn} from 'path'

export function validatePath(path: string): {valid: boolean; reason?: string} {
	if (typeof path !== 'string' || path.length === 0) {
		return {valid: false, reason: 'empty path'}
	}
	if (path.includes('\0')) {
		return {valid: false, reason: 'path contains null bytes'}
	}
	return {valid: true}
}

export function isPathWithinDirectory(path: string, dir: string): boolean {
	const norm = pathNormalize(pathResolveFn(path))
	const dirNorm = pathNormalize(pathResolveFn(dir))
	return norm === dirNorm || norm.startsWith(dirNorm + '/')
}

export function isAbsolutePath(p: string): boolean {
	return pathIsAbsolute(p)
}
