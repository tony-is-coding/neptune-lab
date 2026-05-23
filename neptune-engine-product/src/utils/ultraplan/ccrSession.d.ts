import type { SDKMessage } from '../../entrypoints/agentSdkTypes.js';
export type PollFailReason = 'terminated' | 'timeout_pending' | 'timeout_no_plan' | 'extract_marker_missing' | 'network_or_unknown' | 'stopped';
export declare class UltraplanPollError extends Error {
    readonly reason: PollFailReason;
    readonly rejectCount: number;
    constructor(message: string, reason: PollFailReason, rejectCount: number, options?: ErrorOptions);
}
export declare const ULTRAPLAN_TELEPORT_SENTINEL = "__ULTRAPLAN_TELEPORT_LOCAL__";
export type ScanResult = {
    kind: 'approved';
    plan: string;
} | {
    kind: 'teleport';
    plan: string;
} | {
    kind: 'rejected';
    id: string;
} | {
    kind: 'pending';
} | {
    kind: 'terminated';
    subtype: string;
} | {
    kind: 'unchanged';
};
/**
 * Pill/detail-view state derived from the event stream. Transitions:
 *   running → (turn ends, no ExitPlanMode) → needs_input
 *   needs_input → (user replies in browser) → running
 *   running → (ExitPlanMode emitted, no result yet) → plan_ready
 *   plan_ready → (rejected) → running
 *   plan_ready → (approved) → poll resolves, pill removed
 */
export type UltraplanPhase = 'running' | 'needs_input' | 'plan_ready';
/**
 * Pure stateful classifier for the CCR event stream. Ingests SDKMessage[]
 * batches (as delivered by pollRemoteSessionEvents) and returns the current
 * ExitPlanMode verdict. No I/O, no timers — feed it synthetic or recorded
 * events for unit tests and offline replay.
 *
 * Precedence (approved > terminated > rejected > pending > unchanged):
 * pollRemoteSessionEvents paginates up to 50 pages per call, so one ingest
 * can span seconds of session activity. A batch may contain both an approved
 * tool_result AND a subsequent {type:'result'} (user approved, then remote
 * crashed). The approved plan is real and in threadstore — don't drop it.
 */
export declare class ExitPlanModeScanner {
    private exitPlanCalls;
    private results;
    private rejectedIds;
    private terminated;
    private rescanAfterRejection;
    everSeenPending: boolean;
    get rejectCount(): number;
    /**
     * True when an ExitPlanMode tool_use exists with no tool_result yet —
     * the remote is showing the approval dialog in the browser.
     */
    get hasPendingPlan(): boolean;
    ingest(newEvents: SDKMessage[]): ScanResult;
}
export type PollResult = {
    plan: string;
    rejectCount: number;
    /** 'local' = user clicked teleport (execute here, archive remote). 'remote' = user approved in-CCR execution (don't archive). */
    executionTarget: 'local' | 'remote';
};
export declare function pollForApprovedExitPlanMode(sessionId: string, timeoutMs: number, onPhaseChange?: (phase: UltraplanPhase) => void, shouldStop?: () => boolean): Promise<PollResult>;
//# sourceMappingURL=ccrSession.d.ts.map