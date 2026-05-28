/**
 * cc-shim/cwd.ts — substrate-local 替代 src/utils/cwd.js
 *
 * 设计：substrate 不依赖 cc product 的 AsyncLocalStorage cwd 全局机制。
 * 默认走 process.cwd()。如有需要 override cwd 应通过 ctx.options.cwd 注入。
 *
 * S1.3: 让 builtin-tools 工具不再 from 'src/utils/cwd.js'。
 */

/** Get current working directory (substrate fallback: process.cwd()). */
export function getCwd(): string {
	return process.cwd()
}

/** Synchronous cwd getter (substrate-local; cc product 端会拉 cwdState 兜底，substrate 直接 process.cwd()). */
export function pwd(): string {
	return process.cwd()
}

/**
 * Run a function with overridden cwd. Substrate stub: 直接调 fn()，不切换 cwd。
 * Product 层若需要并发隔离 cwd，可通过 ToolUseContext.options.cwd 传入。
 */
export function runWithCwdOverride<T>(_cwd: string, fn: () => T): T {
	void _cwd
	return fn()
}
