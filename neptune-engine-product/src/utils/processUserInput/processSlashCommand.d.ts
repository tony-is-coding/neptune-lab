import type { ContentBlockParam } from '@anthropic-ai/sdk/resources';
import { type Command } from 'src/commands.js';
import type { SetToolJSXFn, ToolUseContext } from 'src/Tool.js';
import type { AttachmentMessage } from 'src/types/message.js';
import type { CanUseToolFn } from '../../types/permissions.js';
import type { ProcessUserInputBaseResult, ProcessUserInputContext } from './processUserInput.js';
type SlashCommandResult = ProcessUserInputBaseResult & {
    command: Command;
};
/**
 * Determines if a string looks like a valid command name.
 * Valid command names only contain letters, numbers, colons, hyphens, and underscores.
 *
 * @param commandName - The potential command name to check
 * @returns true if it looks like a command name, false if it contains non-command characters
 */
export declare function looksLikeCommand(commandName: string): boolean;
export declare function processSlashCommand(inputString: string, precedingInputBlocks: ContentBlockParam[], imageContentBlocks: ContentBlockParam[], attachmentMessages: AttachmentMessage[], context: ProcessUserInputContext, setToolJSX: SetToolJSXFn, uuid?: string, isAlreadyProcessing?: boolean, canUseTool?: CanUseToolFn): Promise<ProcessUserInputBaseResult>;
/**
 * Formats the metadata for a skill loading message.
 * Used by the Skill tool and for subagent skill preloading.
 */
export declare function formatSkillLoadingMetadata(skillName: string, _progressMessage?: string): string;
export declare function processPromptSlashCommand(commandName: string, args: string, commands: Command[], context: ToolUseContext, imageContentBlocks?: ContentBlockParam[]): Promise<SlashCommandResult>;
export {};
//# sourceMappingURL=processSlashCommand.d.ts.map