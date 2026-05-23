/**
 * Bridge configuration extension point.
 *
 * The framework provides the interface; CLI-specific implementations
 * (like CCR auto-connect) are injected by the CLI layer to avoid
 * circular dependencies.
 */
/**
 * Register the CLI-specific CCR auto-connect implementation.
 * Called from CLI bridge initialization code.
 */
export declare function registerCcrAutoConnectDefault(impl: () => boolean): void;
/**
 * Get the CCR auto-connect default value.
 * Returns false if no implementation is registered (non-CLI builds).
 */
export declare function getCcrAutoConnectDefault(): boolean;
//# sourceMappingURL=bridgeConfig.d.ts.map