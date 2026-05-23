import type { ToolUseContext } from '../Tool.js';
import type { AssistantMessage, Message, RequestStartEvent, StreamEvent, TombstoneMessage, ToolUseSummaryMessage } from '../types/message.js';
import type { SystemPrompt } from '../utils/systemPromptType.js';
import type { QuerySource } from '../constants/querySource.js';
type StopHookResult = {
    blockingErrors: Message[];
    preventContinuation: boolean;
};
export declare function handleStopHooks(messagesForQuery: Message[], assistantMessages: AssistantMessage[], systemPrompt: SystemPrompt, userContext: {
    [k: string]: string;
}, systemContext: {
    [k: string]: string;
}, toolUseContext: ToolUseContext, querySource: QuerySource, stopHookActive?: boolean): AsyncGenerator<StreamEvent | RequestStartEvent | Message | TombstoneMessage | ToolUseSummaryMessage, StopHookResult>;
export {};
//# sourceMappingURL=stopHooks.d.ts.map