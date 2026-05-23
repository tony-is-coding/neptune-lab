/**
 * Package-local runtime/feature flag predicates used by builtin tools.
 *
 * These are intentionally inert defaults that read only from `process.env`
 * and the standard `Bun` global. They never reach into product source
 * (`@neptune/engine-product`, growthbook, settings, etc.). Product hosts
 * that need to override them MUST do so by setting the documented env vars
 * before tool prompts are rendered, or by composing tool prompts in product
 * with their own gating.
 *
 * This file exists so that the engine `builtin-tools` package can stop
 * reaching into `src/utils/embeddedTools.js`, `src/utils/bundledMode.js`,
 * `src/utils/agentSwarmsEnabled.js` etc. — the strategy-doc rule:
 * builtin-tools must not depend on product runtime semantics
 * (docs/strategy/neptune-engine-decoupling-handover.md §1.2).
 */

import {isEnvTruthy} from './env.js'

/**
 * Whether this build embeds bfs/ugrep into the runtime binary so that
 * `find` / `grep` in shell are shadowed by the embedded versions and the
 * dedicated Glob / Grep tools are removed from the registry.
 *
 * Activated by build-time define `EMBEDDED_SEARCH_TOOLS=1`. SDK entrypoints
 * always behave as if it is off (the SDK keeps explicit Glob/Grep tools).
 *
 * Mirrors the predicate used by the host product's
 * `src/utils/embeddedTools.ts` so prompts behave consistently when product
 * forwards `EMBEDDED_SEARCH_TOOLS` and `CLAUDE_CODE_ENTRYPOINT` env vars.
 */
export function hasEmbeddedSearchTools(): boolean {
	if (!isEnvTruthy(process.env.EMBEDDED_SEARCH_TOOLS)) return false
	const entrypoint = process.env.CLAUDE_CODE_ENTRYPOINT
	return (
		entrypoint !== 'sdk-ts' &&
		entrypoint !== 'sdk-py' &&
		entrypoint !== 'sdk-cli' &&
		entrypoint !== 'local-agent'
	)
}

/**
 * Path to the runtime binary that contains the embedded search tools.
 * Only meaningful when `hasEmbeddedSearchTools()` is true.
 */
export function embeddedSearchToolsBinaryPath(): string {
	return process.execPath
}

/**
 * Detects if the current runtime is Bun (native, not via Node compat shim).
 */
export function isRunningWithBun(): boolean {
	// https://bun.com/guides/util/detect-bun
	return typeof process !== 'undefined' && process.versions?.bun !== undefined
}

/**
 * Detects if running as a Bun-compiled standalone executable. This checks
 * for embedded files that are present in compiled binaries.
 *
 * Used by FileReadTool to decide whether the bundled Sharp image processing
 * is available without an installed dependency.
 */
export function isInBundledMode(): boolean {
	return (
		typeof Bun !== 'undefined' &&
		Array.isArray((Bun as unknown as {embeddedFiles?: unknown}).embeddedFiles) &&
		((Bun as unknown as {embeddedFiles: unknown[]}).embeddedFiles.length ?? 0) > 0
	)
}

/**
 * Whether agent-team / multi-agent-swarm features should be visible in
 * builtin-tool prompts (TaskCreate / TaskList / Agent prompts).
 *
 * Engine-side default reads only env-based opt-in:
 *   - `USER_TYPE=ant` (Anthropic-internal builds)
 *   - `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` truthy
 *   - `--agent-teams` CLI flag present in `process.argv`
 *
 * The product host owns its own GrowthBook killswitch on top of this, but
 * builtin-tools should not reach into product analytics. If the product
 * needs the killswitch to suppress prompts, it can either remove the env
 * opt-ins before rendering, or compose its own prompt at registration.
 */
export function isAgentSwarmsEnabled(): boolean {
	if (process.env.USER_TYPE === 'ant') {
		return true
	}
	if (isEnvTruthy(process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS)) {
		return true
	}
	if (typeof process !== 'undefined' && Array.isArray(process.argv)) {
		return process.argv.includes('--agent-teams')
	}
	return false
}

/**
 * Whether `BashTool` should preserve the original CWD across commands.
 *
 * When set, builtin Bash tool keeps the CWD it was launched in and refuses
 * to follow `cd` invocations. Used by SDK / library consumers that drive
 * the tool from a fixed working directory.
 */
export function shouldMaintainProjectWorkingDir(): boolean {
	return isEnvTruthy(process.env.CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR)
}

/**
 * Resolve the configuration home directory for builtin tools.
 *
 * Honors `CLAUDE_CONFIG_DIR` and falls back to `~/.claude`. The product host
 * may further normalize this; builtin tools only need a stable directory to
 * read/write tool-local artifacts and tests.
 *
 * Lazy-imports `os` and `path` so this module remains import-light.
 */
let _cachedConfigHome: {key: string | undefined; value: string} | null = null
export function getClaudeConfigHomeDir(): string {
	const key = process.env.CLAUDE_CONFIG_DIR
	if (_cachedConfigHome && _cachedConfigHome.key === key) {
		return _cachedConfigHome.value
	}
	const {homedir} = require('os') as typeof import('os')
	const {join} = require('path') as typeof import('path')
	const value = (key ?? join(homedir(), '.claude')).normalize('NFC')
	_cachedConfigHome = {key, value}
	return value
}

/**
 * Whether the current build belongs to an Anthropic-internal ("ant")
 * protected namespace. Engine kernel builds always return false; the
 * Anthropic-internal binary linking augments this at the product layer.
 */
export function isInProtectedNamespace(): boolean {
	return false
}
