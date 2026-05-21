import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions/completions.mjs';
import type { AssistantMessage, UserMessage } from '../../../types/message.js';
import type { SystemPrompt } from '../../../utils/systemPromptType.js';
export interface ConvertMessagesOptions {
    /** When true, preserve thinking blocks as reasoning_content on assistant messages
     *  (required for DeepSeek thinking mode with tool calls). */
    enableThinking?: boolean;
}
/**
 * Convert internal (UserMessage | AssistantMessage)[] to OpenAI-format messages.
 *
 * Key conversions:
 * - system prompt → role: "system" message prepended
 * - tool_use blocks → tool_calls[] on assistant message
 * - tool_result blocks → role: "tool" messages
 * - thinking blocks → silently dropped (or preserved as reasoning_content when enableThinking=true)
 * - cache_control → stripped
 */
export declare function anthropicMessagesToOpenAI(messages: (UserMessage | AssistantMessage)[], systemPrompt: SystemPrompt, options?: ConvertMessagesOptions): ChatCompletionMessageParam[];
//# sourceMappingURL=convertMessages.d.ts.map