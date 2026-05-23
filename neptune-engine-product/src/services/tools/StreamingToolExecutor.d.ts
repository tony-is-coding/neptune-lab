import type { ToolUseBlock } from '@anthropic-ai/sdk/resources/index.mjs';
import type { CanUseToolFn } from '../../types/permissions.js';
import { type Tools, type ToolUseContext } from '../../Tool.js';
import type { AssistantMessage, Message } from '../../types/message.js';
type MessageUpdate = {
    message?: Message;
    newContext?: ToolUseContext;
};
/**
 * Executes tools as they stream in with concurrency control.
 * - Concurrent-safe tools can execute in parallel with other concurrent-safe tools
 * - Non-concurrent tools must execute alone (exclusive access)
 * - Results are buffered and emitted in the order tools were received
 */
export declare class StreamingToolExecutor {
    private readonly toolDefinitions;
    private readonly canUseTool;
    private tools;
    private toolUseContext;
    private hasErrored;
    private erroredToolDescription;
    private siblingAbortController;
    private discarded;
    private progressAvailableResolve?;
    private turnSpan;
    constructor(toolDefinitions: Tools, canUseTool: CanUseToolFn, toolUseContext: ToolUseContext);
    /**
     * Discards all pending and in-progress tools. Called when streaming fallback
     * occurs and results from the failed attempt should be abandoned.
     * Queued tools won't start, and in-progress tools will receive synthetic errors.
     */
    discard(): void;
    /**
     * Add a tool to the execution queue. Will start executing immediately if conditions allow.
     */
    addTool(block: ToolUseBlock, assistantMessage: AssistantMessage): void;
    /**
     * Check if a tool can execute based on current concurrency state
     */
    private canExecuteTool;
    /**
     * Process the queue, starting tools when concurrency conditions allow
     */
    private processQueue;
    private createSyntheticErrorMessage;
    /**
     * Determine why a tool should be cancelled.
     */
    private getAbortReason;
    private getToolInterruptBehavior;
    private getToolDescription;
    private updateInterruptibleState;
    /**
     * Execute a tool and collect its results
     */
    private executeTool;
    /**
     * Get any completed results that haven't been yielded yet (non-blocking)
     * Maintains order where necessary
     * Also yields any pending progress messages immediately
     */
    getCompletedResults(): Generator<MessageUpdate, void>;
    /**
     * Check if any tool has pending progress messages
     */
    private hasPendingProgress;
    /**
     * Wait for remaining tools and yield their results as they complete
     * Also yields progress messages as they become available
     */
    getRemainingResults(): AsyncGenerator<MessageUpdate, void>;
    /**
     * Check if there are any completed results ready to yield
     */
    private hasCompletedResults;
    /**
     * Check if there are any tools still executing
     */
    private hasExecutingTools;
    /**
     * Check if there are any unfinished tools
     */
    private hasUnfinishedTools;
    /**
     * Get the current tool use context (may have been modified by context modifiers)
     */
    getUpdatedContext(): ToolUseContext;
}
export {};
//# sourceMappingURL=StreamingToolExecutor.d.ts.map