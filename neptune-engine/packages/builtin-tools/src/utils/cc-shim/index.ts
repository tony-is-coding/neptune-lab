/**
 * cc-shim — substrate-local 替代 cc product src/utils/* 的最小实现
 *
 * 这些 shim 是**substrate 自给自足**的版本，不依赖 cc bootstrap state / AsyncLocalStorage。
 * 行为差异：
 * - cwd: substrate 用 process.cwd() 兜底；cc 用 AsyncLocalStorage cwdOverride
 * - log/debug: substrate 走 console；cc 走 langfuse / sentry / file
 * - path: 算法等价；不依赖 cc fsImplementation 抽象
 * - platform: 等价（Node os.platform）
 *
 * Product 层若需要还原 cc 行为，可通过 ToolUseContext 注入或重定向 import。
 */

export {getCwd, pwd, runWithCwdOverride} from './cwd.js'
export {getPlatform, isWindows, isMac, isLinux} from './platform.js'
export {
	expandPath,
	getDirectoryForPath,
	joinPosix,
	posixPathToWindowsPath,
} from './path.js'
export {
	logError,
	logForDebugging,
	logAntError,
	captureAPIRequest,
} from './log.js'
