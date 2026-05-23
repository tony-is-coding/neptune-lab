import type z from 'zod/v4';
import type { CanUseToolFn } from '../../types/permissions.js';
import type { AnyObject, Tool, ToolUseContext } from '../../Tool.js';
import type { HookProgress } from '../../types/hooks.js';
import type { AssistantMessage, AttachmentMessage, ProgressMessage } from '../../types/message.js';
import type { PermissionDecision } from '../../types/permissions.js';
import { type PermissionResult } from '../../utils/permissions/PermissionResult.js';
import type { McpServerType, MessageUpdateLazy } from './toolExecution.js';
export type PostToolUseHooksResult<Output> = MessageUpdateLazy<AttachmentMessage | ProgressMessage<HookProgress>> | {
    updatedMCPToolOutput: Output;
};
export declare function runPostToolUseHooks<Input extends AnyObject, Output>(toolUseContext: ToolUseContext, tool: Tool<Input, Output>, toolUseID: string, messageId: string, toolInput: Record<string, unknown>, toolResponse: Output, requestId: string | undefined, mcpServerType: McpServerType, mcpServerBaseUrl: string | undefined): AsyncGenerator<PostToolUseHooksResult<Output>>;
export declare function runPostToolUseFailureHooks<Input extends AnyObject>(toolUseContext: ToolUseContext, tool: Tool<Input, unknown>, toolUseID: string, messageId: string, processedInput: z.infer<Input>, error: string, isInterrupt: boolean | undefined, requestId: string | undefined, mcpServerType: McpServerType, mcpServerBaseUrl: string | undefined): AsyncGenerator<MessageUpdateLazy<AttachmentMessage | ProgressMessage<HookProgress>>>;
/**
 * Resolve a PreToolUse hook's permission result into a final PermissionDecision.
 *
 * Encapsulates the invariant that hook 'allow' does NOT bypass settings.json
 * deny/ask rules — checkRuleBasedPermissions still applies (inc-4788 analog).
 * Also handles the requiresUserInteraction/requireCanUseTool guards and the
 * 'ask' forceDecision passthrough.
 *
 * Shared by toolExecution.ts (main query loop) and REPLTool/toolWrappers.ts
 * (REPL inner calls) so the permission semantics stay in lockstep.
 */
export declare function resolveHookPermissionDecision(hookPermissionResult: PermissionResult | undefined, tool: Tool, input: Record<string, unknown>, toolUseContext: ToolUseContext, canUseTool: CanUseToolFn, assistantMessage: AssistantMessage, toolUseID: string): Promise<{
    decision: PermissionDecision;
    input: Record<string, unknown>;
}>;
export declare function runPreToolUseHooks(toolUseContext: ToolUseContext, tool: Tool, processedInput: Record<string, unknown>, toolUseID: string, messageId: string, requestId: string | undefined, mcpServerType: McpServerType, mcpServerBaseUrl: string | undefined): AsyncGenerator<{
    type: 'message';
    message: MessageUpdateLazy<AttachmentMessage | ProgressMessage<HookProgress>>;
} | {
    type: 'hookPermissionResult';
    hookPermissionResult: PermissionResult;
} | {
    type: 'hookUpdatedInput';
    updatedInput: Record<string, unknown>;
} | {
    type: 'preventContinuation';
    shouldPreventContinuation: boolean;
} | {
    type: 'stopReason';
    stopReason: string;
} | {
    type: 'additionalContext';
    message: MessageUpdateLazy<AttachmentMessage>;
} | {
    type: 'stop';
}>;
//# sourceMappingURL=toolHooks.d.ts.map