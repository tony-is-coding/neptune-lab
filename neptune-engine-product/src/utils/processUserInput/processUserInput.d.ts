import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.mjs';
import type { QuerySource } from 'src/constants/querySource.js';
import { type LocalJSXCommandContext } from '../../commands.js';
import type { CanUseToolFn } from '../../types/permissions.js';
import type { IDESelection } from '../../types/ide.js';
import type { SetToolJSXFn, ToolUseContext } from '../../Tool.js';
import type { AssistantMessage, AttachmentMessage, Message, ProgressMessage, SystemMessage, UserMessage } from '../../types/message.js';
import { type PromptInputMode } from '../../types/textInputTypes.js';
import type { PastedContent } from '../config.js';
import type { EffortValue } from '../effort.js';
export type ProcessUserInputContext = ToolUseContext & LocalJSXCommandContext;
export type ProcessUserInputBaseResult = {
    messages: (UserMessage | AssistantMessage | AttachmentMessage | SystemMessage | ProgressMessage)[];
    shouldQuery: boolean;
    allowedTools?: string[];
    model?: string;
    effort?: EffortValue;
    resultText?: string;
    nextInput?: string;
    submitNextInput?: boolean;
};
export declare function processUserInput({ input, preExpansionInput, mode, setToolJSX, context, pastedContents, ideSelection, messages, setUserInputOnProcessing, uuid, isAlreadyProcessing, querySource, canUseTool, skipSlashCommands, bridgeOrigin, isMeta, skipAttachments, }: {
    input: string | Array<ContentBlockParam>;
    /**
     * Input before [Pasted text #N] expansion. Used for ultraplan keyword
     * detection so pasted content containing the word cannot trigger. Falls
     * back to the string `input` when unset.
     */
    preExpansionInput?: string;
    mode: PromptInputMode;
    setToolJSX: SetToolJSXFn;
    context: ProcessUserInputContext;
    pastedContents?: Record<number, PastedContent>;
    ideSelection?: IDESelection;
    messages?: Message[];
    setUserInputOnProcessing?: (prompt?: string) => void;
    uuid?: string;
    isAlreadyProcessing?: boolean;
    querySource?: QuerySource;
    canUseTool?: CanUseToolFn;
    /**
     * When true, input starting with `/` is treated as plain text.
     * Used for remotely-received messages (bridge/CCR) that should not
     * trigger local slash commands or skills.
     */
    skipSlashCommands?: boolean;
    /**
     * When true, slash commands matching isBridgeSafeCommand() execute even
     * though skipSlashCommands is set. See QueuedCommand.bridgeOrigin.
     */
    bridgeOrigin?: boolean;
    /**
     * When true, the resulting UserMessage gets `isMeta: true` (user-hidden,
     * model-visible). Propagated from `QueuedCommand.isMeta` for queued
     * system-generated prompts.
     */
    isMeta?: boolean;
    skipAttachments?: boolean;
}): Promise<ProcessUserInputBaseResult>;
//# sourceMappingURL=processUserInput.d.ts.map