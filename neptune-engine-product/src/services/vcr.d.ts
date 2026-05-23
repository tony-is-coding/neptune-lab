import type { AssistantMessage, Message, StreamEvent, SystemAPIErrorMessage } from '../types/message.js';
export declare function withVCR(messages: Message[], f: () => Promise<(AssistantMessage | StreamEvent | SystemAPIErrorMessage)[]>): Promise<(AssistantMessage | StreamEvent | SystemAPIErrorMessage)[]>;
export declare function withStreamingVCR(messages: Message[], f: () => AsyncGenerator<StreamEvent | AssistantMessage | SystemAPIErrorMessage, void>): AsyncGenerator<StreamEvent | AssistantMessage | SystemAPIErrorMessage, void>;
export declare function withTokenCountVCR(messages: unknown[], tools: unknown[], f: () => Promise<number | null>): Promise<number | null>;
//# sourceMappingURL=vcr.d.ts.map