import { z } from 'zod/v4';
/**
 * Sets the leader's team name for task list resolution.
 * Called by TeamCreateTool when a team is created.
 */
export declare function setLeaderTeamName(teamName: string): void;
/**
 * Clears the leader's team name.
 * Called when a team is deleted.
 */
export declare function clearLeaderTeamName(): void;
/**
 * Register a listener to be called when tasks are updated in this process.
 * Returns an unsubscribe function.
 */
export declare const onTasksUpdated: (listener: () => void) => () => void;
/**
 * Notify listeners that tasks have been updated.
 * Called internally after createTask, updateTask, etc.
 * Wraps emit in try/catch so listener failures never propagate to callers
 * (task mutations must succeed from the caller's perspective).
 */
export declare function notifyTasksUpdated(): void;
export declare const TASK_STATUSES: readonly ["pending", "in_progress", "completed"];
export declare const TaskStatusSchema: () => z.ZodEnum<{
    completed: "completed";
    pending: "pending";
    in_progress: "in_progress";
}>;
export type TaskStatus = z.infer<ReturnType<typeof TaskStatusSchema>>;
export declare const TaskSchema: () => z.ZodObject<{
    id: z.ZodString;
    subject: z.ZodString;
    description: z.ZodString;
    activeForm: z.ZodOptional<z.ZodString>;
    owner: z.ZodOptional<z.ZodString>;
    status: z.ZodEnum<{
        completed: "completed";
        pending: "pending";
        in_progress: "in_progress";
    }>;
    blocks: z.ZodArray<z.ZodString>;
    blockedBy: z.ZodArray<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export type Task = z.infer<ReturnType<typeof TaskSchema>>;
export declare function isTodoV2Enabled(): boolean;
/**
 * Resets the task list for a new swarm - clears any existing tasks.
 * Writes a high water mark file to prevent ID reuse after reset.
 * Should be called when a new swarm is created to ensure task numbering starts at 1.
 * Uses file locking to prevent race conditions when multiple Claudes run in parallel.
 */
export declare function resetTaskList(taskListId: string): Promise<void>;
/**
 * Gets the task list ID based on the current context.
 * Priority:
 * 1. CLAUDE_CODE_TASK_LIST_ID - explicit task list ID
 * 2. In-process teammate: leader's team name (so teammates share the leader's task list)
 * 3. CLAUDE_CODE_TEAM_NAME - set when running as a process-based teammate
 * 4. Leader team name - set when the leader creates a team via TeamCreate
 * 5. Session ID - fallback for standalone sessions
 */
export declare function getTaskListId(): string;
/**
 * Sanitizes a string for safe use in file paths.
 * Removes path traversal characters and other potentially dangerous characters.
 * Only allows alphanumeric characters, hyphens, and underscores.
 */
export declare function sanitizePathComponent(input: string): string;
export declare function getTasksDir(taskListId: string): string;
export declare function getTaskPath(taskListId: string, taskId: string): string;
export declare function ensureTasksDir(taskListId: string): Promise<void>;
/**
 * Creates a new task with a unique ID.
 * Uses file locking to prevent race conditions when multiple processes
 * create tasks concurrently.
 */
export declare function createTask(taskListId: string, taskData: Omit<Task, 'id'>): Promise<string>;
export declare function getTask(taskListId: string, taskId: string): Promise<Task | null>;
export declare function updateTask(taskListId: string, taskId: string, updates: Partial<Omit<Task, 'id'>>): Promise<Task | null>;
export declare function deleteTask(taskListId: string, taskId: string): Promise<boolean>;
export declare function listTasks(taskListId: string): Promise<Task[]>;
export declare function blockTask(taskListId: string, fromTaskId: string, toTaskId: string): Promise<boolean>;
export type ClaimTaskResult = {
    success: boolean;
    reason?: 'task_not_found' | 'already_claimed' | 'already_resolved' | 'blocked' | 'agent_busy';
    task?: Task;
    busyWithTasks?: string[];
    blockedByTasks?: string[];
};
export type ClaimTaskOptions = {
    /**
     * If true, checks whether the agent is already busy (owns other open tasks)
     * before allowing the claim. This check is performed atomically with the claim
     * using a task-list-level lock to prevent TOCTOU race conditions.
     */
    checkAgentBusy?: boolean;
};
/**
 * Attempts to claim a task for an agent with file locking to prevent race conditions.
 * Returns success if the task was claimed, or a reason if it wasn't.
 *
 * When checkAgentBusy is true, uses a task-list-level lock to atomically check
 * if the agent owns any other open tasks before claiming.
 */
export declare function claimTask(taskListId: string, taskId: string, claimantAgentId: string, options?: ClaimTaskOptions): Promise<ClaimTaskResult>;
/**
 * Team member info (subset of TeamFile member structure)
 */
export type TeamMember = {
    agentId: string;
    name: string;
    agentType?: string;
};
/**
 * Agent status based on task ownership
 */
export type AgentStatus = {
    agentId: string;
    name: string;
    agentType?: string;
    status: 'idle' | 'busy';
    currentTasks: string[];
};
/**
 * Gets the status of all agents in a team based on task ownership.
 * An agent is considered "idle" if they don't own any open tasks.
 * An agent is considered "busy" if they own at least one open task.
 *
 * @param teamName - The name of the team (also used as taskListId)
 * @returns Array of agent statuses, or null if team not found
 */
export declare function getAgentStatuses(teamName: string): Promise<AgentStatus[] | null>;
/**
 * Result of unassigning tasks from a teammate
 */
export type UnassignTasksResult = {
    unassignedTasks: Array<{
        id: string;
        subject: string;
    }>;
    notificationMessage: string;
};
/**
 * Unassigns all open tasks from a teammate and builds a notification message.
 * Used when a teammate is killed or gracefully shuts down.
 *
 * @param teamName - The team/task list name
 * @param teammateId - The teammate's agent ID
 * @param teammateName - The teammate's display name
 * @param reason - How the teammate exited ('terminated' | 'shutdown')
 * @returns The unassigned tasks and a formatted notification message
 */
export declare function unassignTeammateTasks(teamName: string, teammateId: string, teammateName: string, reason: 'terminated' | 'shutdown'): Promise<UnassignTasksResult>;
export declare const DEFAULT_TASKS_MODE_TASK_LIST_ID = "tasklist";
//# sourceMappingURL=tasks.d.ts.map