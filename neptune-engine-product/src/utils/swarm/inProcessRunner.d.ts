/**
 * In-process teammate runner
 *
 * Wraps runAgent() for in-process teammates, providing:
 * - AsyncLocalStorage-based context isolation via runWithTeammateContext()
 * - Progress tracking and AppState updates
 * - Idle notification to leader when complete
 * - Plan mode approval flow support
 * - Cleanup on completion or abort
 */
import type { ToolUseContext } from '../../Tool.js';
import type { TeammateIdentity } from '../../tasks/InProcessTeammateTask/types.js';
import type { CustomAgentDefinition } from '@neptune/builtin-tools/tools/AgentTool/loadAgentsDir.js';
import type { Message } from '../../types/message.js';
import type { TeammateContext } from '../teammateContext.js';
/**
 * Configuration for running an in-process teammate.
 */
export type InProcessRunnerConfig = {
    /** Teammate identity for context */
    identity: TeammateIdentity;
    /** Task ID in AppState */
    taskId: string;
    /** Initial prompt for the teammate */
    prompt: string;
    /** Optional agent definition (for specialized agents) */
    agentDefinition?: CustomAgentDefinition;
    /** Teammate context for AsyncLocalStorage */
    teammateContext: TeammateContext;
    /** Parent's tool use context */
    toolUseContext: ToolUseContext;
    /** Abort controller linked to parent */
    abortController: AbortController;
    /** Optional model override for this teammate */
    model?: string;
    /** Optional system prompt override for this teammate */
    systemPrompt?: string;
    /** How to apply the system prompt: 'replace' or 'append' to default */
    systemPromptMode?: 'default' | 'replace' | 'append';
    /** Tool permissions to auto-allow for this teammate */
    allowedTools?: string[];
    /** Whether this teammate can show permission prompts for unlisted tools.
     * When false (default), unlisted tools are auto-denied. */
    allowPermissionPrompts?: boolean;
    /** Short description of the task (used as summary for the initial prompt header) */
    description?: string;
    /** request_id of the API call that spawned this teammate, for lineage
     *  tracing on tengu_api_* events. */
    invokingRequestId?: string;
};
/**
 * Result from running an in-process teammate.
 */
export type InProcessRunnerResult = {
    /** Whether the run completed successfully */
    success: boolean;
    /** Error message if failed */
    error?: string;
    /** Messages produced by the agent */
    messages: Message[];
};
/**
 * Runs an in-process teammate with a continuous prompt loop.
 *
 * Executes runAgent() within the teammate's AsyncLocalStorage context,
 * tracks progress, updates task state, sends idle notification on completion,
 * then waits for new prompts or shutdown requests.
 *
 * Unlike background tasks, teammates stay alive and can receive multiple prompts.
 * The loop only exits on abort or after shutdown is approved by the model.
 *
 * @param config - Runner configuration
 * @returns Result with messages and success status
 */
export declare function runInProcessTeammate(config: InProcessRunnerConfig): Promise<InProcessRunnerResult>;
/**
 * Starts an in-process teammate in the background.
 *
 * This is the main entry point called after spawn. It starts the agent
 * execution loop in a fire-and-forget manner.
 *
 * @param config - Runner configuration
 */
export declare function startInProcessTeammate(config: InProcessRunnerConfig): void;
//# sourceMappingURL=inProcessRunner.d.ts.map