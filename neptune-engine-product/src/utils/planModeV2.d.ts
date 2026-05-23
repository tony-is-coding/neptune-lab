export declare function getPlanModeV2AgentCount(): number;
export declare function getPlanModeV2ExploreAgentCount(): number;
/**
 * Check if plan mode interview phase is enabled.
 *
 * Config: ant=always_on, external=tengu_plan_mode_interview_phase gate, envVar=true
 */
export declare function isPlanModeInterviewPhaseEnabled(): boolean;
export type PewterLedgerVariant = 'trim' | 'cut' | 'cap' | null;
/**
 * tengu_pewter_ledger — plan file structure prompt experiment.
 *
 * Controls the Phase 4 "Final Plan" bullets in the 5-phase plan mode
 * workflow (messages.ts getPlanPhase4Section). 5-phase is 99% of plan
 * traffic; interview-phase (ants) is untouched as a reference population.
 *
 * Arms: null (control), 'trim', 'cut', 'cap' — progressively stricter
 * guidance on plan file size.
 *
 * Baseline (control, 14d ending 2026-03-02, N=26.3M):
 *   p50 4,906 chars | p90 11,617 | mean 6,207 | 82% Opus 4.6
 *   Reject rate monotonic with size: 20% at <2K → 50% at 20K+
 *
 * Primary: session-level Avg Cost (fact__201omjcij85f) — Opus output is
 *   5× input price so cost is an output-weighted proxy. planLengthChars
 *   on tengu_plan_exit is the mechanism but NOT the goal — the cap arm
 *   could shrink the plan file while increasing total output via
 *   write→count→edit cycles.
 * Guardrail: feedback-bad rate, requests/session (too-thin plans →
 *   more implementation iterations), tool error rate
 */
export declare function getPewterLedgerVariant(): PewterLedgerVariant;
//# sourceMappingURL=planModeV2.d.ts.map