import type { SDKMessage } from 'src/entrypoints/agentSdkTypes.js';
import { type Tool, type Tools } from '../Tool.js';
import type { Message } from '../types/message.js';
import type { OrphanedPermission } from '../types/textInputTypes.js';
import { type FileStateCache } from './fileStateCache.js';
import type { inputSchema as permissionToolInputSchema, outputSchema as permissionToolOutputSchema } from './permissions/PermissionPromptToolResultSchema.js';
import type { ProcessUserInputContext } from './processUserInput/processUserInput.js';
export type PermissionPromptTool = Tool<ReturnType<typeof permissionToolInputSchema>, ReturnType<typeof permissionToolOutputSchema>>;
/**
 * Checks if the result should be considered successful based on the last message.
 * Returns true if:
 * - Last message is assistant with text/thinking content
 * - Last message is user with only tool_result blocks
 * - Last message is the user prompt but the API completed with end_turn
 *   (model chose to emit no content blocks)
 */
export declare function isResultSuccessful(message: Message | undefined, stopReason?: string | null): message is Message;
export declare function normalizeMessage(message: Message): Generator<SDKMessage>;
export declare function handleOrphanedPermission(orphanedPermission: OrphanedPermission, tools: Tools, mutableMessages: Message[], processUserInputContext: ProcessUserInputContext): AsyncGenerator<SDKMessage, void, unknown>;
export declare function extractReadFilesFromMessages(messages: Message[], cwd: string, maxSize?: number): FileStateCache;
/**
 * Extract the top-level CLI tools used in BashTool calls from message history.
 * Returns a deduplicated set of command names (e.g. 'vercel', 'aws', 'git').
 */
export declare function extractBashToolsFromMessages(messages: Message[]): Set<string>;
//# sourceMappingURL=queryHelpers.d.ts.map