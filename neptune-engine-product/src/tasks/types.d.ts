import type { DreamTaskState } from './DreamTask/DreamTask.js';
import type { InProcessTeammateTaskState } from './InProcessTeammateTask/types.js';
import type { LocalAgentTaskState } from './LocalAgentTask/LocalAgentTask.js';
import type { LocalShellTaskState } from './LocalShellTask/guards.js';
import type { LocalWorkflowTaskState } from './LocalWorkflowTask/LocalWorkflowTask.js';
import type { MonitorMcpTaskState } from './MonitorMcpTask/MonitorMcpTask.js';
import type { RemoteAgentTaskState } from './RemoteAgentTask/RemoteAgentTask.js';
export type TaskState = LocalShellTaskState | LocalAgentTaskState | RemoteAgentTaskState | InProcessTeammateTaskState | LocalWorkflowTaskState | MonitorMcpTaskState | DreamTaskState;
export type BackgroundTaskState = LocalShellTaskState | LocalAgentTaskState | RemoteAgentTaskState | InProcessTeammateTaskState | LocalWorkflowTaskState | MonitorMcpTaskState | DreamTaskState;
/**
 * Check if a task should be shown in the background tasks indicator.
 * A task is considered a background task if:
 * 1. It is running or pending
 * 2. It has been explicitly backgrounded (not a foreground task)
 */
export declare function isBackgroundTask(task: TaskState): task is BackgroundTaskState;
//# sourceMappingURL=types.d.ts.map