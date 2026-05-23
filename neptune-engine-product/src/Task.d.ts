import type { AppState } from './state/AppStateStore.js';
import type { AgentId } from './types/ids.js';
export type TaskType = 'local_bash' | 'local_agent' | 'remote_agent' | 'in_process_teammate' | 'local_workflow' | 'monitor_mcp' | 'dream';
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'killed';
/**
 * True when a task is in a terminal state and will not transition further.
 * Used to guard against injecting messages into dead teammates, evicting
 * finished tasks from AppState, and orphan-cleanup paths.
 */
export declare function isTerminalTaskStatus(status: TaskStatus): boolean;
export type TaskHandle = {
    taskId: string;
    cleanup?: () => void;
};
export type SetAppState = (f: (prev: AppState) => AppState) => void;
export type TaskContext = {
    abortController: AbortController;
    getAppState: () => AppState;
    setAppState: SetAppState;
};
export type TaskStateBase = {
    id: string;
    type: TaskType;
    status: TaskStatus;
    description: string;
    toolUseId?: string;
    startTime: number;
    endTime?: number;
    totalPausedMs?: number;
    outputFile: string;
    outputOffset: number;
    notified: boolean;
};
export type LocalShellSpawnInput = {
    command: string;
    description: string;
    timeout?: number;
    toolUseId?: string;
    agentId?: AgentId;
    /** UI display variant: description-as-label, dialog title, status bar pill. */
    kind?: 'bash' | 'monitor';
};
export type Task = {
    name: string;
    type: TaskType;
    kill(taskId: string, setAppState: SetAppState): Promise<void>;
};
export declare function generateTaskId(type: TaskType): string;
export declare function createTaskStateBase(id: string, type: TaskType, description: string, toolUseId?: string): TaskStateBase;
//# sourceMappingURL=Task.d.ts.map