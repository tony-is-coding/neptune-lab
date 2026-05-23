/**
 * Bridge configuration extension point.
 *
 * The framework provides the interface; CLI-specific implementations
 * (like CCR auto-connect) are injected by the CLI layer to avoid
 * circular dependencies.
 */

/**
 * Get the default value for CCR auto-connect.
 * CLI-specific implementation injected from bridge/bridgeEnabled.ts.
 * Returns false by default when no implementation is registered.
 */
let getCcrAutoConnectDefaultImpl: (() => boolean) | undefined

/**
 * Register the CLI-specific CCR auto-connect implementation.
 * Called from CLI bridge initialization code.
 */
export function registerCcrAutoConnectDefault(
	impl: () => boolean,
): void {
	getCcrAutoConnectDefaultImpl = impl
}

/**
 * Get the CCR auto-connect default value.
 * Returns false if no implementation is registered (non-CLI builds).
 */
export function getCcrAutoConnectDefault(): boolean {
	return getCcrAutoConnectDefaultImpl?.() ?? false
}
