/**
 * cc-shim/log.ts — substrate-local 替代 src/utils/log.js + src/utils/debug.js
 *
 * substrate 不感知 cc product 的 telemetry 后端。logError/logForDebugging 走 console。
 * Product 层若需要把这些转向 langfuse / sentry，自行替换 import。
 */

export function logError(error: unknown, _context?: string): void {
	if (error instanceof Error) {
		// eslint-disable-next-line no-console
		console.error('[error]', error.message, error.stack)
	} else {
		// eslint-disable-next-line no-console
		console.error('[error]', String(error))
	}
}

export function logForDebugging(
	message: string,
	options?: {level?: 'info' | 'warn' | 'error' | 'debug'; metadata?: Record<string, unknown>},
): void {
	const level = options?.level ?? 'debug'
	const meta = options?.metadata ?? {}
	if (level === 'error') {
		// eslint-disable-next-line no-console
		console.error(`[debug:error] ${message}`, meta)
	} else if (level === 'warn') {
		// eslint-disable-next-line no-console
		console.warn(`[debug:warn] ${message}`, meta)
	} else if (level === 'info') {
		// eslint-disable-next-line no-console
		console.info(`[debug:info] ${message}`, meta)
	} else {
		// eslint-disable-next-line no-console
		console.debug(`[debug] ${message}`, meta)
	}
}

export function logAntError(error: unknown, _ctx?: unknown): void {
	logError(error)
}

export function captureAPIRequest(_data: unknown, _querySource?: string): void {
	// no-op in substrate
}
