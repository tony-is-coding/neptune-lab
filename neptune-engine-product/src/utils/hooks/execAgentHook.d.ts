import type { HookEvent } from 'src/entrypoints/agentSdkTypes.js';
import type { ToolUseContext } from '../../Tool.js';
import type { Message } from '../../types/message.js';
import type { HookResult } from '../hooks.js';
import type { AgentHook } from '../settings/types.js';
/**
 * Execute an agent-based hook using a multi-turn LLM query
 */
export declare function execAgentHook(hook: AgentHook, hookName: string, hookEvent: HookEvent, jsonInput: string, signal: AbortSignal, toolUseContext: ToolUseContext, toolUseID: string | undefined, _messages: Message[], agentName?: string): Promise<HookResult>;
//# sourceMappingURL=execAgentHook.d.ts.map