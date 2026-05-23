/**
 * Prompt templates for the background memory extraction agent.
 *
 * The extraction agent runs as a perfect fork of the main conversation — same
 * system prompt, same message prefix. The main agent's system prompt always
 * has full save instructions; when the main agent writes memories itself,
 * extractMemories.ts skips that turn (hasMemoryWritesSince). This prompt
 * fires only when the main agent didn't write, so the save-criteria here
 * overlap the system prompt's harmlessly.
 */
/**
 * Build the extraction prompt for auto-only memory (no team memory).
 * Four-type taxonomy, no scope guidance (single directory).
 */
export declare function buildExtractAutoOnlyPrompt(newMessageCount: number, existingMemories: string, skipIndex?: boolean): string;
/**
 * Build the extraction prompt for combined auto + team memory.
 * Four-type taxonomy with per-type <scope> guidance (directory choice
 * is baked into each type block, no separate routing section needed).
 */
export declare function buildExtractCombinedPrompt(newMessageCount: number, existingMemories: string, skipIndex?: boolean): string;
//# sourceMappingURL=prompts.d.ts.map