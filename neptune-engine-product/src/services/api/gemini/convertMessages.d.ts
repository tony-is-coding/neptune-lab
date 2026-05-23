import type { AssistantMessage, UserMessage } from '../../../types/message.js';
import type { SystemPrompt } from '../../../utils/systemPromptType.js';
import { type GeminiGenerateContentRequest } from './types.js';
export declare function anthropicMessagesToGemini(messages: (UserMessage | AssistantMessage)[], systemPrompt: SystemPrompt): Pick<GeminiGenerateContentRequest, 'contents' | 'systemInstruction'>;
//# sourceMappingURL=convertMessages.d.ts.map