import type { ContentBlockParam } from '@anthropic-ai/sdk/resources';
import type { AttachmentMessage, SystemMessage, UserMessage } from 'src/types/message.js';
import type { PermissionMode } from '../../types/permissions.js';
export declare function processTextPrompt(input: string | Array<ContentBlockParam>, imageContentBlocks: ContentBlockParam[], imagePasteIds: number[], attachmentMessages: AttachmentMessage[], uuid?: string, permissionMode?: PermissionMode, isMeta?: boolean): {
    messages: (UserMessage | AttachmentMessage | SystemMessage)[];
    shouldQuery: boolean;
};
//# sourceMappingURL=processTextPrompt.d.ts.map