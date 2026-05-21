/**
 * Days elapsed since mtime.  Floor-rounded — 0 for today, 1 for
 * yesterday, 2+ for older.  Negative inputs (future mtime, clock skew)
 * clamp to 0.
 */
export declare function memoryAgeDays(mtimeMs: number): number;
/**
 * Human-readable age string.  Models are poor at date arithmetic —
 * a raw ISO timestamp doesn't trigger staleness reasoning the way
 * "47 days ago" does.
 */
export declare function memoryAge(mtimeMs: number): string;
/**
 * Plain-text staleness caveat for memories >1 day old.  Returns ''
 * for fresh (today/yesterday) memories — warning there is noise.
 *
 * Use this when the consumer already provides its own wrapping
 * (e.g. messages.ts relevant_memories → wrapMessagesInSystemReminder).
 *
 * Motivated by user reports of stale code-state memories (file:line
 * citations to code that has since changed) being asserted as fact —
 * the citation makes the stale claim sound more authoritative, not less.
 */
export declare function memoryFreshnessText(mtimeMs: number): string;
/**
 * Per-memory staleness note wrapped in <system-reminder> tags.
 * Returns '' for memories ≤ 1 day old.  Use this for callers that
 * don't add their own system-reminder wrapper (e.g. FileReadTool output).
 */
export declare function memoryFreshnessNote(mtimeMs: number): string;
//# sourceMappingURL=memoryAge.d.ts.map