import type { ToolUseBlock } from '@anthropic-ai/sdk/resources/index.mjs';
import type { CanUseToolFn } from '../../types/permissions.js';
import { type ToolUseContext } from '../../Tool.js';
import type { AssistantMessage, Message } from '../../types/message.js';
export type MessageUpdate = {
    message?: Message;
    newContext: ToolUseContext;
};
export declare function runTools(toolUseMessages: ToolUseBlock[], assistantMessages: AssistantMessage[], canUseTool: CanUseToolFn, toolUseContext: ToolUseContext): AsyncGenerator<MessageUpdate, void>;
//# sourceMappingURL=toolOrchestration.d.ts.map