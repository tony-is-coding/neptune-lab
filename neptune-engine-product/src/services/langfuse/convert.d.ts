/**
 * Convert internal Message types to Langfuse-compatible OpenAI-style chat format.
 *
 * Langfuse generations expect:
 *   input:  { role, content }[]  where content is string or structured parts
 *   output: { role: 'assistant', content: string | part[] }
 */
import type { AssistantMessage, UserMessage } from 'src/types/message.js';
type LangfuseContentPart = {
    type: 'text';
    text: string;
} | {
    type: 'tool_use';
    id: string;
    name: string;
    input: unknown;
} | {
    type: 'tool_result';
    tool_use_id: string;
    content: string;
} | {
    type: 'thinking';
    thinking: string;
} | {
    type: string;
    [key: string]: unknown;
};
type LangfuseChatMessage = {
    role: 'user' | 'assistant' | 'system';
    content: string | LangfuseContentPart[];
};
/** Convert messagesForAPI (UserMessage | AssistantMessage)[] → Langfuse input format */
export declare function convertMessagesToLangfuse(messages: (UserMessage | AssistantMessage)[], systemPrompt?: readonly string[]): LangfuseChatMessage[];
/** Convert AssistantMessage[] (newMessages) → Langfuse output format (last assistant turn) */
export declare function convertOutputToLangfuse(messages: AssistantMessage[]): LangfuseChatMessage | LangfuseChatMessage[] | null;
export {};
//# sourceMappingURL=convert.d.ts.map