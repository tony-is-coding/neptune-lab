import { z } from 'zod/v4';
import { type HookEvent, type HookInput, type PermissionUpdate } from 'src/entrypoints/agentSdkTypes.js';
import type { HookJSONOutput, AsyncHookJSONOutput, SyncHookJSONOutput } from 'src/entrypoints/agentSdkTypes.js';
import type { Message } from 'src/types/message.js';
import type { PermissionResult } from 'src/utils/permissions/PermissionResult.js';
import type { AppState } from '../state/AppStateStore.js';
import type { AttributionState } from '../utils/commitAttribution.js';
export declare function isHookEvent(value: string): value is HookEvent;
export declare const promptRequestSchema: () => z.ZodObject<{
    prompt: z.ZodString;
    message: z.ZodString;
    options: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        label: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type PromptRequest = z.infer<ReturnType<typeof promptRequestSchema>>;
export type PromptResponse = {
    prompt_response: string;
    selected: string;
};
export declare const syncHookResponseSchema: () => z.ZodObject<{
    continue: z.ZodOptional<z.ZodBoolean>;
    suppressOutput: z.ZodOptional<z.ZodBoolean>;
    stopReason: z.ZodOptional<z.ZodString>;
    decision: z.ZodOptional<z.ZodEnum<{
        block: "block";
        approve: "approve";
    }>>;
    reason: z.ZodOptional<z.ZodString>;
    systemMessage: z.ZodOptional<z.ZodString>;
    hookSpecificOutput: z.ZodOptional<z.ZodUnion<readonly [z.ZodObject<{
        hookEventName: z.ZodLiteral<"PreToolUse">;
        permissionDecision: any;
        permissionDecisionReason: z.ZodOptional<z.ZodString>;
        updatedInput: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        additionalContext: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"UserPromptSubmit">;
        additionalContext: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"SessionStart">;
        additionalContext: z.ZodOptional<z.ZodString>;
        initialUserMessage: z.ZodOptional<z.ZodString>;
        watchPaths: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"Setup">;
        additionalContext: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"SubagentStart">;
        additionalContext: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"PostToolUse">;
        additionalContext: z.ZodOptional<z.ZodString>;
        updatedMCPToolOutput: z.ZodOptional<z.ZodUnknown>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"PostToolUseFailure">;
        additionalContext: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"PermissionDenied">;
        retry: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"Notification">;
        additionalContext: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"PermissionRequest">;
        decision: z.ZodUnion<readonly [z.ZodObject<{
            behavior: z.ZodLiteral<"allow">;
            updatedInput: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            updatedPermissions: z.ZodOptional<z.ZodArray<any>>;
        }, z.core.$strip>, z.ZodObject<{
            behavior: z.ZodLiteral<"deny">;
            message: z.ZodOptional<z.ZodString>;
            interrupt: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>]>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"Elicitation">;
        action: z.ZodOptional<z.ZodEnum<{
            cancel: "cancel";
            accept: "accept";
            decline: "decline";
        }>>;
        content: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"ElicitationResult">;
        action: z.ZodOptional<z.ZodEnum<{
            cancel: "cancel";
            accept: "accept";
            decline: "decline";
        }>>;
        content: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"CwdChanged">;
        watchPaths: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"FileChanged">;
        watchPaths: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"WorktreeCreate">;
        worktreePath: z.ZodString;
    }, z.core.$strip>]>>;
}, z.core.$strip>;
export declare const hookJSONOutputSchema: () => z.ZodUnion<readonly [z.ZodObject<{
    async: z.ZodLiteral<true>;
    asyncTimeout: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>, z.ZodObject<{
    continue: z.ZodOptional<z.ZodBoolean>;
    suppressOutput: z.ZodOptional<z.ZodBoolean>;
    stopReason: z.ZodOptional<z.ZodString>;
    decision: z.ZodOptional<z.ZodEnum<{
        block: "block";
        approve: "approve";
    }>>;
    reason: z.ZodOptional<z.ZodString>;
    systemMessage: z.ZodOptional<z.ZodString>;
    hookSpecificOutput: z.ZodOptional<z.ZodUnion<readonly [z.ZodObject<{
        hookEventName: z.ZodLiteral<"PreToolUse">;
        permissionDecision: any;
        permissionDecisionReason: z.ZodOptional<z.ZodString>;
        updatedInput: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        additionalContext: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"UserPromptSubmit">;
        additionalContext: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"SessionStart">;
        additionalContext: z.ZodOptional<z.ZodString>;
        initialUserMessage: z.ZodOptional<z.ZodString>;
        watchPaths: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"Setup">;
        additionalContext: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"SubagentStart">;
        additionalContext: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"PostToolUse">;
        additionalContext: z.ZodOptional<z.ZodString>;
        updatedMCPToolOutput: z.ZodOptional<z.ZodUnknown>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"PostToolUseFailure">;
        additionalContext: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"PermissionDenied">;
        retry: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"Notification">;
        additionalContext: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"PermissionRequest">;
        decision: z.ZodUnion<readonly [z.ZodObject<{
            behavior: z.ZodLiteral<"allow">;
            updatedInput: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            updatedPermissions: z.ZodOptional<z.ZodArray<any>>;
        }, z.core.$strip>, z.ZodObject<{
            behavior: z.ZodLiteral<"deny">;
            message: z.ZodOptional<z.ZodString>;
            interrupt: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>]>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"Elicitation">;
        action: z.ZodOptional<z.ZodEnum<{
            cancel: "cancel";
            accept: "accept";
            decline: "decline";
        }>>;
        content: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"ElicitationResult">;
        action: z.ZodOptional<z.ZodEnum<{
            cancel: "cancel";
            accept: "accept";
            decline: "decline";
        }>>;
        content: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"CwdChanged">;
        watchPaths: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"FileChanged">;
        watchPaths: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"WorktreeCreate">;
        worktreePath: z.ZodString;
    }, z.core.$strip>]>>;
}, z.core.$strip>]>;
export declare function isSyncHookJSONOutput(json: HookJSONOutput): json is SyncHookJSONOutput;
export declare function isAsyncHookJSONOutput(json: HookJSONOutput): json is AsyncHookJSONOutput;
/** Context passed to callback hooks for state access */
export type HookCallbackContext = {
    getAppState: () => AppState;
    updateAttributionState: (updater: (prev: AttributionState) => AttributionState) => void;
};
/** Hook that is a callback. */
export type HookCallback = {
    type: 'callback';
    callback: (input: HookInput, toolUseID: string | null, abort: AbortSignal | undefined, 
    /** Hook index for SessionStart hooks to compute CLAUDE_ENV_FILE path */
    hookIndex?: number, 
    /** Optional context for accessing app state */
    context?: HookCallbackContext) => Promise<HookJSONOutput>;
    /** Timeout in seconds for this hook */
    timeout?: number;
    /** Internal hooks (e.g. session file access analytics) are excluded from tengu_run_hook metrics */
    internal?: boolean;
};
export type HookCallbackMatcher = {
    matcher?: string;
    hooks: HookCallback[];
    pluginName?: string;
};
export type HookProgress = {
    type: 'hook_progress';
    hookEvent: HookEvent;
    hookName: string;
    command: string;
    promptText?: string;
    statusMessage?: string;
};
export type HookBlockingError = {
    blockingError: string;
    command: string;
};
export type PermissionRequestResult = {
    behavior: 'allow';
    updatedInput?: Record<string, unknown>;
    updatedPermissions?: PermissionUpdate[];
} | {
    behavior: 'deny';
    message?: string;
    interrupt?: boolean;
};
export type HookResult = {
    message?: Message;
    systemMessage?: Message;
    blockingError?: HookBlockingError;
    outcome: 'success' | 'blocking' | 'non_blocking_error' | 'cancelled';
    preventContinuation?: boolean;
    stopReason?: string;
    permissionBehavior?: 'ask' | 'deny' | 'allow' | 'passthrough';
    hookPermissionDecisionReason?: string;
    additionalContext?: string;
    initialUserMessage?: string;
    updatedInput?: Record<string, unknown>;
    updatedMCPToolOutput?: unknown;
    permissionRequestResult?: PermissionRequestResult;
    retry?: boolean;
};
export type AggregatedHookResult = {
    message?: Message;
    blockingErrors?: HookBlockingError[];
    preventContinuation?: boolean;
    stopReason?: string;
    hookPermissionDecisionReason?: string;
    permissionBehavior?: PermissionResult['behavior'];
    additionalContexts?: string[];
    initialUserMessage?: string;
    updatedInput?: Record<string, unknown>;
    updatedMCPToolOutput?: unknown;
    permissionRequestResult?: PermissionRequestResult;
    retry?: boolean;
};
//# sourceMappingURL=hooks.d.ts.map