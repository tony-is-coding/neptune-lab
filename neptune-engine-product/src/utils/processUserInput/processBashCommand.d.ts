import type { ContentBlockParam } from '@anthropic-ai/sdk/resources';
import type { SetToolJSXFn } from 'src/Tool.js';
import type { AttachmentMessage, SystemMessage, UserMessage } from 'src/types/message.js';
import type { ProcessUserInputContext } from './processUserInput.js';
export declare function processBashCommand(inputString: string, precedingInputBlocks: ContentBlockParam[], attachmentMessages: AttachmentMessage[], context: ProcessUserInputContext, setToolJSX: SetToolJSXFn): Promise<{
    messages: (UserMessage | AttachmentMessage | SystemMessage)[];
    shouldQuery: boolean;
}>;
//# sourceMappingURL=processBashCommand.d.ts.map