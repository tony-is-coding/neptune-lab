import type { SystemPrompt } from '../../../utils/systemPromptType.js';
import type { Message, StreamEvent, SystemAPIErrorMessage, AssistantMessage } from '../../../types/message.js';
import type { Tools } from '../../../Tool.js';
import type { Options } from '../claude.js';
/**
 * Grok (xAI) query path. Grok uses an OpenAI-compatible API, so we reuse
 * the OpenAI message/tool converters and stream adapter. Only the client
 * (different base URL + API key) and model mapping are Grok-specific.
 */
export declare function queryModelGrok(messages: Message[], systemPrompt: SystemPrompt, tools: Tools, signal: AbortSignal, options: Options): AsyncGenerator<StreamEvent | AssistantMessage | SystemAPIErrorMessage, void>;
//# sourceMappingURL=index.d.ts.map