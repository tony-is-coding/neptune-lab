import {feature} from 'bun:bundle'
import {prependBullets} from 'src/constants/prompts.js'
import {hasEmbeddedSearchTools} from 'src/utils/embeddedTools.js'
import {isEnvTruthy} from 'src/utils/envUtils.js'
import {getClaudeTempDir} from 'src/utils/permissions/filesystem.js'
import {SandboxManager} from 'src/utils/sandbox/sandbox-adapter.js'
import {jsonStringify} from '../../utils/json.js'
import {
	getDefaultBashTimeoutMs,
	getMaxBashTimeoutMs,
} from 'src/utils/timeouts.js'
import {FILE_EDIT_TOOL_NAME} from '../FileEditTool/constants.js'
import {FILE_READ_TOOL_NAME} from '../FileReadTool/prompt.js'
import {FILE_WRITE_TOOL_NAME} from '../FileWriteTool/prompt.js'
import {GLOB_TOOL_NAME} from '../GlobTool/prompt.js'
import {GREP_TOOL_NAME} from '../GrepTool/prompt.js'
import {BASH_TOOL_NAME} from './toolName.js'

export function getDefaultTimeoutMs(): number {
	return getDefaultBashTimeoutMs()
}

export function getMaxTimeoutMs(): number {
	return getMaxBashTimeoutMs()
}

function getBackgroundUsageNote(): string | null {
	if (isEnvTruthy(process.env.CLAUDE_CODE_DISABLE_BACKGROUND_TASKS)) {
		return null
	}
	return "You can use the `run_in_background` parameter to run the command in the background. Only use this if you don't need the result immediately and are OK being notified when the command completes later. You do not need to check the output right away - you'll be notified when it finishes. You do not need to use '&' at the end of the command when using this parameter."
}

// SandboxManager merges config from multiple sources (settings layers, defaults,
// CLI flags) without deduping, so paths like ~/.cache appear 3× in allowOnly.
// Dedup here before inlining into the prompt — affects only what the model sees,
// not sandbox enforcement. Saves ~150-200 tokens/request when sandbox is enabled.
function dedup<T>(arr: T[] | undefined): T[] | undefined {
	if (!arr || arr.length === 0) return arr
	return [...new Set(arr)]
}

function getSimpleSandboxSection(): string {
	if (!SandboxManager.isSandboxingEnabled()) {
		return ''
	}

	const fsReadConfig = SandboxManager.getFsReadConfig()
	const fsWriteConfig = SandboxManager.getFsWriteConfig()
	const networkRestrictionConfig = SandboxManager.getNetworkRestrictionConfig()
	const allowUnixSockets = SandboxManager.getAllowUnixSockets()
	const ignoreViolations = SandboxManager.getIgnoreViolations()
	const allowUnsandboxedCommands =
		SandboxManager.areUnsandboxedCommandsAllowed()

	// Replace the per-UID temp dir literal (e.g. /private/tmp/claude-1001/) with
	// "$TMPDIR" so the prompt is identical across users — avoids busting the
	// cross-user global prompt cache. The sandbox already sets $TMPDIR at runtime.
	const claudeTempDir = getClaudeTempDir()
	const normalizeAllowOnly = (paths: string[]): string[] =>
		[...new Set(paths)].map(p => (p === claudeTempDir ? '$TMPDIR' : p))

	const filesystemConfig = {
		read: {
			denyOnly: dedup(fsReadConfig.denyOnly),
			...(fsReadConfig.allowWithinDeny && {
				allowWithinDeny: dedup(fsReadConfig.allowWithinDeny),
			}),
		},
		write: {
			allowOnly: normalizeAllowOnly(fsWriteConfig.allowOnly),
			denyWithinAllow: dedup(fsWriteConfig.denyWithinAllow),
		},
	}

	const networkConfig = {
		...(networkRestrictionConfig?.allowedHosts && {
			allowedHosts: dedup(networkRestrictionConfig.allowedHosts),
		}),
		...(networkRestrictionConfig?.deniedHosts && {
			deniedHosts: dedup(networkRestrictionConfig.deniedHosts),
		}),
		...(allowUnixSockets && {allowUnixSockets: dedup(allowUnixSockets)}),
	}

	const restrictionsLines = []
	if (Object.keys(filesystemConfig).length > 0) {
		restrictionsLines.push(`Filesystem: ${jsonStringify(filesystemConfig)}`)
	}
	if (Object.keys(networkConfig).length > 0) {
		restrictionsLines.push(`Network: ${jsonStringify(networkConfig)}`)
	}
	if (ignoreViolations) {
		restrictionsLines.push(
			`Ignored violations: ${jsonStringify(ignoreViolations)}`,
		)
	}

	const sandboxOverrideItems: Array<string | string[]> =
		allowUnsandboxedCommands
			? [
				'You should always default to running commands within the sandbox. Do NOT attempt to set `dangerouslyDisableSandbox: true` unless:',
				[
					'The user *explicitly* asks you to bypass sandbox',
					'A specific command just failed and you see evidence of sandbox restrictions causing the failure. Note that commands can fail for many reasons unrelated to the sandbox (missing files, wrong arguments, network issues, etc.).',
				],
				'Evidence of sandbox-caused failures includes:',
				[
					'"Operation not permitted" errors for file/network operations',
					'Access denied to specific paths outside allowed directories',
					'Network connection failures to non-whitelisted hosts',
					'Unix socket connection errors',
				],
				'When you see evidence of sandbox-caused failure:',
				[
					"Immediately retry with `dangerouslyDisableSandbox: true` (don't ask, just do it)",
					'Briefly explain what sandbox restriction likely caused the failure. Be sure to mention that the user can use the `/sandbox` command to manage restrictions.',
					'This will prompt the user for permission',
				],
				'Treat each command you execute with `dangerouslyDisableSandbox: true` individually. Even if you have recently run a command with this setting, you should default to running future commands within the sandbox.',
				'Do not suggest adding sensitive paths like ~/.bashrc, ~/.zshrc, ~/.ssh/*, or credential files to the sandbox allowlist.',
			]
			: [
				'All commands MUST run in sandbox mode - the `dangerouslyDisableSandbox` parameter is disabled by policy.',
				'Commands cannot run outside the sandbox under any circumstances.',
				'If a command fails due to sandbox restrictions, work with the user to adjust sandbox settings instead.',
			]

	const items: Array<string | string[]> = [
		...sandboxOverrideItems,
		'For temporary files, always use the `$TMPDIR` environment variable. TMPDIR is automatically set to the correct sandbox-writable directory in sandbox mode. Do NOT use `/tmp` directly - use `$TMPDIR` instead.',
	]

	return [
		'',
		'## Command sandbox',
		'By default, your command will be run in a sandbox. This sandbox controls which directories and network hosts commands may access or modify without an explicit override.',
		'',
		'The sandbox has the following restrictions:',
		restrictionsLines.join('\n'),
		'',
		...prependBullets(items),
	].join('\n')
}

export function getSimplePrompt(): string {
	// Ant-native builds alias find/grep to embedded bfs/ugrep in Claude's shell,
	// so we don't steer away from them (and Glob/Grep tools are removed).
	const embedded = hasEmbeddedSearchTools()

	const toolPreferenceItems = [
		...(embedded
			? []
			: [
				`File search: Use ${GLOB_TOOL_NAME} (NOT find or ls)`,
				`Content search: Use ${GREP_TOOL_NAME} (NOT grep or rg)`,
			]),
		`Read files: Use ${FILE_READ_TOOL_NAME} (NOT cat/head/tail)`,
		`Edit files: Use ${FILE_EDIT_TOOL_NAME} (NOT sed/awk)`,
		`Write files: Use ${FILE_WRITE_TOOL_NAME} (NOT echo >/cat <<EOF)`,
		'Communication: Output text directly (NOT echo/printf)',
	]

	const avoidCommands = embedded
		? '`cat`, `head`, `tail`, `sed`, `awk`, or `echo`'
		: '`find`, `grep`, `cat`, `head`, `tail`, `sed`, `awk`, or `echo`'

	const multipleCommandsSubitems = [
		`If the commands are independent and can run in parallel, make multiple ${BASH_TOOL_NAME} tool calls in a single message. Example: if you need to run "git status" and "git diff", send a single message with two ${BASH_TOOL_NAME} tool calls in parallel.`,
		`If the commands depend on each other and must run sequentially, use a single ${BASH_TOOL_NAME} call with '&&' to chain them together.`,
		"Use ';' only when you need to run commands sequentially but don't care if earlier commands fail.",
		'DO NOT use newlines to separate commands (newlines are ok in quoted strings).',
	]

	const sleepSubitems = [
		'Do not sleep between commands that can run immediately — just run them.',
		...(feature('MONITOR_TOOL')
			? [
				'Use the Monitor tool to stream events from a background process (each stdout line is a notification). For one-shot "wait until done," use Bash with run_in_background instead.',
			]
			: []),
		'If your command is long running and you would like to be notified when it finishes — use `run_in_background`. No sleep needed.',
		'Do not retry failing commands in a sleep loop — diagnose the root cause.',
		'If waiting for a background task you started with `run_in_background`, you will be notified when it completes — do not poll.',
		...(feature('MONITOR_TOOL')
			? [
				'`sleep N` as the first command with N ≥ 2 is blocked. If you need a delay (rate limiting, deliberate pacing), keep it under 2 seconds.',
			]
			: [
				'If you must poll an external process, use a check command (e.g. `gh run view`) rather than sleeping first.',
				'If you must sleep, keep the duration short (1-5 seconds) to avoid blocking the user.',
			]),
	]
	const backgroundNote = getBackgroundUsageNote()

	const instructionItems: Array<string | string[]> = [
		'If your command will create new directories or files, first use this tool to run `ls` to verify the parent directory exists and is the correct location.',
		'Always quote file paths that contain spaces with double quotes in your command (e.g., cd "path with spaces/file.txt")',
		'Try to maintain your current working directory throughout the session by using absolute paths and avoiding usage of `cd`. You may use `cd` if the User explicitly requests it.',
		`You may specify an optional timeout in milliseconds (up to ${getMaxTimeoutMs()}ms / ${getMaxTimeoutMs() / 60000} minutes). By default, your command will timeout after ${getDefaultTimeoutMs()}ms (${getDefaultTimeoutMs() / 60000} minutes).`,
		...(backgroundNote !== null ? [backgroundNote] : []),
		'When issuing multiple commands:',
		multipleCommandsSubitems,
		'Avoid unnecessary `sleep` commands:',
		sleepSubitems,
		...(embedded
			? [
				// bfs (which backs `find`) uses Oniguruma for -regex, which picks the
				// FIRST matching alternative (leftmost-first), unlike GNU find's
				// POSIX leftmost-longest. This silently drops matches when a shorter
				// alternative is a prefix of a longer one.
				"When using `find -regex` with alternation, put the longest alternative first. Example: use `'.*\\.\\(tsx\\|ts\\)'` not `'.*\\.\\(ts\\|tsx\\)'` — the second form silently skips `.tsx` files.",
			]
			: []),
	]

	return [
		'Executes a given bash command and returns its output.',
		'',
		"The working directory persists between commands, but shell state does not. The shell environment is initialized from the user's profile (bash or zsh).",
		'',
		`IMPORTANT: Avoid using this tool to run ${avoidCommands} commands, unless explicitly instructed or after you have verified that a dedicated tool cannot accomplish your task. Instead, use the appropriate dedicated tool as this will provide a much better experience for the user:`,
		'',
		...prependBullets(toolPreferenceItems),
		`While the ${BASH_TOOL_NAME} tool can do similar things, it’s better to use the built-in tools as they provide a better user experience and make it easier to review tool calls and give permission.`,
		'',
		'# Instructions',
		...prependBullets(instructionItems),
		getSimpleSandboxSection(),
	].join('\n')
}
