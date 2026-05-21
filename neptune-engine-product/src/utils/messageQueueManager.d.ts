import type { AppState } from '../state/AppState.js';
import type { EditablePromptInputMode, PromptInputMode, QueuedCommand, QueuePriority } from '../types/textInputTypes.js';
import type { PastedContent } from './config.js';
export type SetAppState = (f: (prev: AppState) => AppState) => void;
/**
 * Subscribe to command queue changes.
 * Compatible with React's useSyncExternalStore.
 */
export declare const subscribeToCommandQueue: (listener: () => void) => () => void;
/**
 * Get current snapshot of the command queue.
 * Compatible with React's useSyncExternalStore.
 * Returns a frozen array that only changes reference on mutation.
 */
export declare function getCommandQueueSnapshot(): readonly QueuedCommand[];
/**
 * Get a mutable copy of the current queue.
 * Use for one-off reads where you need the actual commands.
 */
export declare function getCommandQueue(): QueuedCommand[];
/**
 * Get the current queue length without copying.
 */
export declare function getCommandQueueLength(): number;
/**
 * Check if there are commands in the queue.
 */
export declare function hasCommandsInQueue(): boolean;
/**
 * Trigger a re-check by notifying subscribers.
 * Use after async processing completes to ensure remaining commands
 * are picked up by useSyncExternalStore consumers.
 */
export declare function recheckCommandQueue(): void;
/**
 * Add a command to the queue.
 * Used for user-initiated commands (prompt, bash, orphaned-permission).
 * Defaults priority to 'next' (processed before task notifications).
 */
export declare function enqueue(command: QueuedCommand): void;
/**
 * Add a task notification to the queue.
 * Convenience wrapper that defaults priority to 'later' so user input
 * is never starved by system messages.
 */
export declare function enqueuePendingNotification(command: QueuedCommand): void;
/**
 * Remove and return the highest-priority command, or undefined if empty.
 * Within the same priority level, commands are dequeued FIFO.
 *
 * An optional `filter` narrows the candidates: only commands for which the
 * predicate returns `true` are considered. Non-matching commands stay in the
 * queue untouched. This lets between-turn drains (SDK, REPL) restrict to
 * main-thread commands (`cmd.agentId === undefined`) without restructuring
 * the existing while-loop patterns.
 */
export declare function dequeue(filter?: (cmd: QueuedCommand) => boolean): QueuedCommand | undefined;
/**
 * Remove and return all commands from the queue.
 * Logs a dequeue operation for each command.
 */
export declare function dequeueAll(): QueuedCommand[];
/**
 * Return the highest-priority command without removing it, or undefined if empty.
 * Accepts an optional `filter` — only commands passing the predicate are considered.
 */
export declare function peek(filter?: (cmd: QueuedCommand) => boolean): QueuedCommand | undefined;
/**
 * Remove and return all commands matching a predicate, preserving priority order.
 * Non-matching commands stay in the queue.
 */
export declare function dequeueAllMatching(predicate: (cmd: QueuedCommand) => boolean): QueuedCommand[];
/**
 * Remove specific commands from the queue by reference identity.
 * Callers must pass the same object references that are in the queue
 * (e.g. from getCommandsByMaxPriority). Logs a 'remove' operation for each.
 */
export declare function remove(commandsToRemove: QueuedCommand[]): void;
/**
 * Remove commands matching a predicate.
 * Returns the removed commands.
 */
export declare function removeByFilter(predicate: (cmd: QueuedCommand) => boolean): QueuedCommand[];
/**
 * Clear all commands from the queue.
 * Used by ESC cancellation to discard queued notifications.
 */
export declare function clearCommandQueue(): void;
/**
 * Clear all commands and reset snapshot.
 * Used for test cleanup.
 */
export declare function resetCommandQueue(): void;
export declare function isPromptInputModeEditable(mode: PromptInputMode): mode is EditablePromptInputMode;
/**
 * Whether this queued command can be pulled into the input buffer via UP/ESC.
 * System-generated commands (proactive ticks, scheduled tasks, plan
 * verification, channel messages) contain raw XML and must not leak into
 * the user's input.
 */
export declare function isQueuedCommandEditable(cmd: QueuedCommand): boolean;
/**
 * Whether this queued command should render in the queue preview under the
 * prompt. Superset of editable — channel messages show (so the keyboard user
 * sees what arrived) but stay non-editable (raw XML).
 */
export declare function isQueuedCommandVisible(cmd: QueuedCommand): boolean;
export type PopAllEditableResult = {
    text: string;
    cursorOffset: number;
    images: PastedContent[];
};
/**
 * Pop all editable commands and combine them with current input for editing.
 * Notification modes (task-notification) are left in the queue
 * to be auto-processed later.
 * Returns object with combined text, cursor offset, and images to restore.
 * Returns undefined if no editable commands in queue.
 */
export declare function popAllEditable(currentInput: string, currentCursorOffset: number): PopAllEditableResult | undefined;
/** @deprecated Use subscribeToCommandQueue */
export declare const subscribeToPendingNotifications: (listener: () => void) => () => void;
/** @deprecated Use getCommandQueueSnapshot */
export declare function getPendingNotificationsSnapshot(): readonly QueuedCommand[];
/** @deprecated Use hasCommandsInQueue */
export declare const hasPendingNotifications: typeof hasCommandsInQueue;
/** @deprecated Use getCommandQueueLength */
export declare const getPendingNotificationsCount: typeof getCommandQueueLength;
/** @deprecated Use recheckCommandQueue */
export declare const recheckPendingNotifications: typeof recheckCommandQueue;
/** @deprecated Use dequeue */
export declare function dequeuePendingNotification(): QueuedCommand | undefined;
/** @deprecated Use resetCommandQueue */
export declare const resetPendingNotifications: typeof resetCommandQueue;
/** @deprecated Use clearCommandQueue */
export declare const clearPendingNotifications: typeof clearCommandQueue;
/**
 * Get commands at or above a given priority level without removing them.
 * Useful for mid-chain draining where only urgent items should be processed.
 *
 * Priority order: 'now' (0) > 'next' (1) > 'later' (2).
 * Passing 'now' returns only now-priority commands; 'later' returns everything.
 */
export declare function getCommandsByMaxPriority(maxPriority: QueuePriority): QueuedCommand[];
/**
 * Returns true if the command is a slash command that should be routed through
 * processSlashCommand rather than sent to the model as text.
 *
 * Commands with `skipSlashCommands` (e.g. bridge/CCR messages) are NOT treated
 * as slash commands — their text is meant for the model.
 */
export declare function isSlashCommand(cmd: QueuedCommand): boolean;
//# sourceMappingURL=messageQueueManager.d.ts.map