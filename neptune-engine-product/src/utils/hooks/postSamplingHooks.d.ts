import type { QuerySource } from '../../constants/querySource.js';
import type { ToolUseContext } from '../../Tool.js';
import type { Message } from '../../types/message.js';
import type { SystemPrompt } from '../systemPromptType.js';
export type REPLHookContext = {
    messages: Message[];
    systemPrompt: SystemPrompt;
    userContext: {
        [k: string]: string;
    };
    systemContext: {
        [k: string]: string;
    };
    toolUseContext: ToolUseContext;
    querySource?: QuerySource;
};
export type PostSamplingHook = (context: REPLHookContext) => Promise<void> | void;
/**
 * Register a post-sampling hook that will be called after model sampling completes
 * This is an internal API not exposed through settings
 */
export declare function registerPostSamplingHook(hook: PostSamplingHook): void;
/**
 * Clear all registered post-sampling hooks (for testing)
 */
export declare function clearPostSamplingHooks(): void;
/**
 * Execute all registered post-sampling hooks
 */
export declare function executePostSamplingHooks(messages: Message[], systemPrompt: SystemPrompt, userContext: {
    [k: string]: string;
}, systemContext: {
    [k: string]: string;
}, toolUseContext: ToolUseContext, querySource?: QuerySource): Promise<void>;
//# sourceMappingURL=postSamplingHooks.d.ts.map