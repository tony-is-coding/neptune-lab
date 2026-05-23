type ComputeFn = () => string | null | Promise<string | null>;
type SystemPromptSection = {
    name: string;
    compute: ComputeFn;
    cacheBreak: boolean;
};
/**
 * Create a memoized system prompt section.
 * Computed once, cached until /clear or /compact.
 */
export declare function systemPromptSection(name: string, compute: ComputeFn): SystemPromptSection;
/**
 * Create a volatile system prompt section that recomputes every turn.
 * This WILL break the prompt cache when the value changes.
 * Requires a reason explaining why cache-breaking is necessary.
 */
export declare function DANGEROUS_uncachedSystemPromptSection(name: string, compute: ComputeFn, _reason: string): SystemPromptSection;
/**
 * Resolve all system prompt sections, returning prompt strings.
 */
export declare function resolveSystemPromptSections(sections: SystemPromptSection[]): Promise<(string | null)[]>;
/**
 * Clear all system prompt section state. Called on /clear and /compact.
 * Also resets beta header latches so a fresh conversation gets fresh
 * evaluation of AFK/fast-mode/cache-editing headers.
 */
export declare function clearSystemPromptSections(): void;
export {};
//# sourceMappingURL=systemPromptSections.d.ts.map