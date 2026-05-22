export class TelemetrySafeError_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS extends Error {
	readonly telemetryMessage: string

	constructor(message: string, telemetryMessage?: string) {
		super(message)
		this.name = 'TelemetrySafeError'
		this.telemetryMessage = telemetryMessage ?? message
	}
}

export class AbortError extends Error {
	constructor(message?: string) {
		super(message)
		this.name = 'AbortError'
	}
}

export function toError(error: unknown): Error {
	return error instanceof Error ? error : new Error(String(error))
}

export function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

export function getErrnoCode(error: unknown): string | undefined {
	if (
		error &&
		typeof error === 'object' &&
		'code' in error &&
		typeof error.code === 'string'
	) {
		return error.code
	}
	return undefined
}

export function isENOENT(error: unknown): boolean {
	return getErrnoCode(error) === 'ENOENT'
}
