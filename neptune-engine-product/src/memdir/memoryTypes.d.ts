/**
 * Memory type taxonomy.
 *
 * Memories are constrained to four types capturing context NOT derivable
 * from the current project state. Code patterns, architecture, git history,
 * and file structure are derivable (via grep/git/CLAUDE.md) and should NOT
 * be saved as memories.
 *
 * The two TYPES_SECTION_* exports below are intentionally duplicated rather
 * than generated from a shared spec — keeping them flat makes per-mode edits
 * trivial without reasoning through a helper's conditional rendering.
 */
export declare const MEMORY_TYPES: readonly ["user", "feedback", "project", "reference"];
export type MemoryType = (typeof MEMORY_TYPES)[number];
/**
 * Parse a raw frontmatter value into a MemoryType.
 * Invalid or missing values return undefined — legacy files without a
 * `type:` field keep working, files with unknown types degrade gracefully.
 */
export declare function parseMemoryType(raw: unknown): MemoryType | undefined;
/**
 * `## Types of memory` section for COMBINED mode (private + team directories).
 * Includes <scope> tags and team/private qualifiers in examples.
 */
export declare const TYPES_SECTION_COMBINED: readonly string[];
/**
 * `## Types of memory` section for INDIVIDUAL-ONLY mode (single directory).
 * No <scope> tags. Examples use plain `[saves X memory: …]`. Prose that
 * only makes sense with a private/team split is reworded.
 */
export declare const TYPES_SECTION_INDIVIDUAL: readonly string[];
/**
 * `## What NOT to save in memory` section. Identical across both modes.
 */
export declare const WHAT_NOT_TO_SAVE_SECTION: readonly string[];
/**
 * Recall-side drift caveat. Single bullet under `## When to access memories`.
 * Proactive: verify memory against current state before answering.
 */
export declare const MEMORY_DRIFT_CAVEAT = "- Memory records can become stale over time. Use memory as context for what was true at a given point in time. Before answering the user or building assumptions based solely on information in memory records, verify that the memory is still correct and up-to-date by reading the current state of the files or resources. If a recalled memory conflicts with current information, trust what you observe now \u2014 and update or remove the stale memory rather than acting on it.";
/**
 * `## When to access memories` section. Includes MEMORY_DRIFT_CAVEAT.
 *
 * H6 (branch-pollution evals #22856, case 5 1/3 on capy): the "ignore" bullet
 * is the delta. Failure mode: user says "ignore memory about X" → Claude reads
 * code correctly but adds "not Y as noted in memory" — treats "ignore" as
 * "acknowledge then override" rather than "don't reference at all." The bullet
 * names that anti-pattern explicitly.
 *
 * Token budget (H6a): merged old bullets 1+2, tightened both. Old 4 lines
 * were ~70 tokens; new 4 lines are ~73 tokens. Net ~+3.
 */
export declare const WHEN_TO_ACCESS_SECTION: readonly string[];
/**
 * `## Trusting what you recall` section. Heavier-weight guidance on HOW to
 * treat a memory once you've recalled it — separate from WHEN to access.
 *
 * Eval-validated (memory-prompt-iteration.eval.ts, 2026-03-17):
 *   H1 (verify function/file claims): 0/2 → 3/3 via appendSystemPrompt. When
 *      buried as a bullet under "When to access", dropped to 0/3 — position
 *      matters. The H1 cue is about what to DO with a memory, not when to
 *      look, so it needs its own section-level trigger context.
 *   H5 (read-side noise rejection): 0/2 → 3/3 via appendSystemPrompt, 2/3
 *      in-place as a bullet. Partial because "snapshot" is intuitively closer
 *      to "when to access" than H1 is.
 *
 * Known gap: H1 doesn't cover slash-command claims (0/3 on the /fork case —
 * slash commands aren't files or functions in the model's ontology).
 */
export declare const TRUSTING_RECALL_SECTION: readonly string[];
/**
 * Frontmatter format example with the `type` field.
 */
export declare const MEMORY_FRONTMATTER_EXAMPLE: readonly string[];
//# sourceMappingURL=memoryTypes.d.ts.map