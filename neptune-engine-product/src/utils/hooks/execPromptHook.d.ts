import type { HookEvent } from 'src/entrypoints/agentSdkTypes.js';
import type { ToolUseContext } from '../../Tool.js';
import type { Message } from '../../types/message.js';
import type { HookResult } from '../hooks.js';
import type { PromptHook } from '../settings/types.js';
/**
 * Execute a prompt-based hook using an LLM
 */
export declare function execPromptHook(hook: PromptHook, hookName: string, hookEvent: HookEvent, jsonInput: string, signal: AbortSignal, toolUseContext: ToolUseContext, messages?: Message[], toolUseID?: string): Promise<HookResult>;
//# sourceMappingURL=execPromptHook.d.ts.map