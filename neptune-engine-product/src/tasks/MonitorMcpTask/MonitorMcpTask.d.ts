import type { AppState } from '../../state/AppState.js';
import type { SetAppState, Task, TaskStateBase } from '../../Task.js';
import type { AgentId } from '../../types/ids.js';
export type MonitorMcpTaskState = TaskStateBase & {
    type: 'monitor_mcp';
    /** The MCP server name being monitored. */
    serverName: string;
    /** The resource URI being subscribed to. */
    resourceUri: string;
    /** The shell command used to drive monitoring (if any). */
    command?: string;
    /** Agent that spawned this task. Used to kill orphaned tasks on agent exit. */
    agentId?: AgentId;
    /** Abort controller to cancel the subscription. */
    abortController?: AbortController;
};
export declare function isMonitorMcpTask(task: unknown): task is MonitorMcpTaskState;
export declare function registerMonitorMcpTask(setAppState: SetAppState, opts: {
    description: string;
    serverName: string;
    resourceUri: string;
    command?: string;
    toolUseId?: string;
    agentId?: AgentId;
    abortController?: AbortController;
}): string;
export declare function completeMonitorMcpTask(taskId: string, setAppState: SetAppState): void;
export declare function failMonitorMcpTask(taskId: string, setAppState: SetAppState): void;
export declare function killMonitorMcp(taskId: string, setAppState: SetAppState): void;
/**
 * Kill all running monitor_mcp tasks spawned by a given agent.
 * Called from runAgent.ts finally block so subscriptions don't outlive
 * the agent that started them.
 */
export declare function killMonitorMcpTasksForAgent(agentId: AgentId, getAppState: () => AppState, setAppState: SetAppState): void;
export declare const MonitorMcpTask: Task;
//# sourceMappingURL=MonitorMcpTask.d.ts.map