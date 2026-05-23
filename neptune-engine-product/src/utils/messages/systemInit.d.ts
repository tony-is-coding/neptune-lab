import type { PermissionMode, SDKMessage } from 'src/entrypoints/agentSdkTypes.js';
export declare function sdkCompatToolName(name: string): string;
type CommandLike = {
    name: string;
    userInvocable?: boolean;
};
export type SystemInitInputs = {
    tools: ReadonlyArray<{
        name: string;
    }>;
    mcpClients: ReadonlyArray<{
        name: string;
        type: string;
    }>;
    model: string;
    permissionMode: PermissionMode;
    commands: ReadonlyArray<CommandLike>;
    agents: ReadonlyArray<{
        agentType: string;
    }>;
    skills: ReadonlyArray<CommandLike>;
    plugins: ReadonlyArray<{
        name: string;
        path: string;
        source: string;
    }>;
    fastMode: boolean | undefined;
};
/**
 * Build the `system/init` SDKMessage — the first message on the SDK stream
 * carrying session metadata (cwd, tools, model, commands, etc.) that remote
 * clients use to render pickers and gate UI.
 *
 * Called from two paths that must produce identical shapes:
 *   - QueryEngine (spawn-bridge / print-mode / SDK) — yielded as the first
 *     stream message per query turn
 *   - useReplBridge (REPL Remote Control) — sent via writeSdkMessages() on
 *     bridge connect, since REPL uses query() directly and never hits the
 *     QueryEngine SDKMessage layer
 */
export declare function buildSystemInitMessage(inputs: SystemInitInputs): SDKMessage;
export {};
//# sourceMappingURL=systemInit.d.ts.map