import type { SetAppState, Task, TaskStateBase } from '../../Task.js';
export type DreamTurn = {
    text: string;
    toolUseCount: number;
};
export type DreamPhase = 'starting' | 'updating';
export type DreamTaskState = TaskStateBase & {
    type: 'dream';
    phase: DreamPhase;
    sessionsReviewing: number;
    /**
     * Paths observed in Edit/Write tool_use blocks via onMessage. This is an
     * INCOMPLETE reflection of what the dream agent actually changed — it misses
     * any bash-mediated writes and only captures the tool calls we pattern-match.
     * Treat as "at least these were touched", not "only these were touched".
     */
    filesTouched: string[];
    /** Assistant text responses, tool uses collapsed. Prompt is NOT included. */
    turns: DreamTurn[];
    abortController?: AbortController;
    /** Stashed so kill can rewind the lock mtime (same path as fork-failure). */
    priorMtime: number;
};
export declare function isDreamTask(task: unknown): task is DreamTaskState;
export declare function registerDreamTask(setAppState: SetAppState, opts: {
    sessionsReviewing: number;
    priorMtime: number;
    abortController: AbortController;
}): string;
export declare function addDreamTurn(taskId: string, turn: DreamTurn, touchedPaths: string[], setAppState: SetAppState): void;
export declare function completeDreamTask(taskId: string, setAppState: SetAppState): void;
export declare function failDreamTask(taskId: string, setAppState: SetAppState): void;
export declare const DreamTask: Task;
//# sourceMappingURL=DreamTask.d.ts.map