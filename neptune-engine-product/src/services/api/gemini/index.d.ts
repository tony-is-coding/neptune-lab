import type { AssistantMessage, Message, StreamEvent, SystemAPIErrorMessage } from '../../../types/message.js';
import { type Tools } from '../../../Tool.js';
import type { SystemPrompt } from '../../../utils/systemPromptType.js';
import type { ThinkingConfig } from '../../../utils/thinking.js';
import type { Options } from '../claude.js';
export declare function queryModelGemini(messages: Message[], systemPrompt: SystemPrompt, tools: Tools, signal: AbortSignal, options: Options, thinkingConfig: ThinkingConfig): AsyncGenerator<StreamEvent | AssistantMessage | SystemAPIErrorMessage, void>;
//# sourceMappingURL=index.d.ts.map