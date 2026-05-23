import type { UUID } from 'crypto';
import type { AttributionSnapshotMessage, ContextCollapseCommitEntry, ContextCollapseSnapshotEntry, LogOption, PersistedWorktreeSession, SerializedMessage } from '../types/logs.js';
import type { Message, NormalizedUserMessage } from '../types/message.js';
import { type FileHistorySnapshot } from './fileHistory.js';
import type { ContentReplacementRecord } from './toolResultStorage.js';
export type TeleportRemoteResponse = {
    log: Message[];
    branch?: string;
};
export type TurnInterruptionState = {
    kind: 'none';
} | {
    kind: 'interrupted_prompt';
    message: NormalizedUserMessage;
};
export type DeserializeResult = {
    messages: Message[];
    turnInterruptionState: TurnInterruptionState;
};
/**
 * Deserializes messages from a log file into the format expected by the REPL.
 * Filters unresolved tool uses, orphaned thinking messages, and appends a
 * synthetic assistant sentinel when the last message is from the user.
 * @internal Exported for testing - use loadConversationForResume instead
 */
export declare function deserializeMessages(serializedMessages: Message[]): Message[];
/**
 * Like deserializeMessages, but also detects whether the session was
 * interrupted mid-turn. Used by the SDK resume path to auto-continue
 * interrupted turns after a gateway-triggered restart.
 * @internal Exported for testing
 */
export declare function deserializeMessagesWithInterruptDetection(serializedMessages: Message[]): DeserializeResult;
/**
 * Restores skill state from invoked_skills attachments in messages.
 * This ensures that skills are preserved across resume after compaction.
 * Without this, if another compaction happens after resume, the skills would be lost
 * because STATE.invokedSkills would be empty.
 * @internal Exported for testing - use loadConversationForResume instead
 */
export declare function restoreSkillStateFromMessages(messages: Message[]): void;
/**
 * Chain-walk a transcript jsonl by path.  Same sequence loadFullLog
 * runs internally — loadTranscriptFile → find newest non-sidechain
 * leaf → buildConversationChain → removeExtraFields — just starting
 * from an arbitrary path instead of the sid-derived one.
 *
 * leafUuids is populated by loadTranscriptFile as "uuids that no
 * other message's parentUuid points at" — the chain tips.  There can
 * be several (sidechains, orphans); newest non-sidechain is the main
 * conversation's end.
 */
export declare function loadMessagesFromJsonlPath(path: string): Promise<{
    messages: SerializedMessage[];
    sessionId: UUID | undefined;
}>;
/**
 * Loads a conversation for resume from various sources.
 * This is the centralized function for loading and deserializing conversations.
 *
 * @param source - The source to load from:
 *   - undefined: load most recent conversation
 *   - string: session ID to load
 *   - LogOption: already loaded conversation
 * @param sourceJsonlFile - Alternate: path to a transcript jsonl.
 *   Used when --resume receives a .jsonl path (cli/print.ts routes
 *   on suffix), typically for cross-directory resume where the
 *   transcript lives outside the current project dir.
 * @returns Object containing the deserialized messages and the original log, or null if not found
 */
export declare function loadConversationForResume(source: string | LogOption | undefined, sourceJsonlFile: string | undefined): Promise<{
    messages: Message[];
    turnInterruptionState: TurnInterruptionState;
    fileHistorySnapshots?: FileHistorySnapshot[];
    attributionSnapshots?: AttributionSnapshotMessage[];
    contentReplacements?: ContentReplacementRecord[];
    contextCollapseCommits?: ContextCollapseCommitEntry[];
    contextCollapseSnapshot?: ContextCollapseSnapshotEntry;
    sessionId: UUID | undefined;
    agentName?: string;
    agentColor?: string;
    agentSetting?: string;
    customTitle?: string;
    tag?: string;
    mode?: 'coordinator' | 'normal';
    worktreeSession?: PersistedWorktreeSession | null;
    prNumber?: number;
    prUrl?: string;
    prRepository?: string;
    fullPath?: string;
} | null>;
//# sourceMappingURL=conversationRecovery.d.ts.map