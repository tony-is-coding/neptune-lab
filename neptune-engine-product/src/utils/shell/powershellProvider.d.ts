import type { ShellProvider } from './shellProvider.js';
/**
 * PowerShell invocation flags + command. Shared by the provider's getSpawnArgs
 * and the hook spawn path in hooks.ts so the flag set stays in one place.
 */
export declare function buildPowerShellArgs(cmd: string): string[];
export declare function createPowerShellProvider(shellPath: string): ShellProvider;
//# sourceMappingURL=powershellProvider.d.ts.map