import type { Message, UserMessage } from '../types/message.js';
/**
 * Filter function to select user messages that should be selectable in the UI.
 * Messages are excluded if they are:
 * - Not user type
 * - Tool results
 * - Synthetic messages
 * - Meta messages
 * - Compact summaries or transcript-only messages
 * - Terminal/command output messages
 */
export declare function selectableUserMessagesFilter(message: Message): message is UserMessage;
//# sourceMappingURL=messageSelection.d.ts.map