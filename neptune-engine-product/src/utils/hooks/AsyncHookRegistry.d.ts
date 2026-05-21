import type { AsyncHookJSONOutput, HookEvent, SyncHookJSONOutput } from 'src/entrypoints/agentSdkTypes.js';
import type { ShellCommand } from '../ShellCommand.js';
export type PendingAsyncHook = {
    processId: string;
    hookId: string;
    hookName: string;
    hookEvent: HookEvent | 'StatusLine' | 'FileSuggestion';
    toolName?: string;
    pluginId?: string;
    startTime: number;
    timeout: number;
    command: string;
    responseAttachmentSent: boolean;
    shellCommand?: ShellCommand;
    stopProgressInterval: () => void;
};
export declare function registerPendingAsyncHook({ processId, hookId, asyncResponse, hookName, hookEvent, command, shellCommand, toolName, pluginId, }: {
    processId: string;
    hookId: string;
    asyncResponse: AsyncHookJSONOutput;
    hookName: string;
    hookEvent: HookEvent | 'StatusLine' | 'FileSuggestion';
    command: string;
    shellCommand: ShellCommand;
    toolName?: string;
    pluginId?: string;
}): void;
export declare function getPendingAsyncHooks(): PendingAsyncHook[];
export declare function checkForAsyncHookResponses(): Promise<Array<{
    processId: string;
    response: SyncHookJSONOutput;
    hookName: string;
    hookEvent: HookEvent | 'StatusLine' | 'FileSuggestion';
    toolName?: string;
    pluginId?: string;
    stdout: string;
    stderr: string;
    exitCode?: number;
}>>;
export declare function removeDeliveredAsyncHooks(processIds: string[]): void;
export declare function finalizePendingAsyncHooks(): Promise<void>;
export declare function clearAllAsyncHooks(): void;
//# sourceMappingURL=AsyncHookRegistry.d.ts.map