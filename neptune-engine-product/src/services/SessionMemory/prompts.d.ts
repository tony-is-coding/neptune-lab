export declare const DEFAULT_SESSION_MEMORY_TEMPLATE = "\n# Session Title\n_A short and distinctive 5-10 word descriptive title for the session. Super info dense, no filler_\n\n# Current State\n_What is actively being worked on right now? Pending tasks not yet completed. Immediate next steps._\n\n# Task specification\n_What did the user ask to build? Any design decisions or other explanatory context_\n\n# Files and Functions\n_What are the important files? In short, what do they contain and why are they relevant?_\n\n# Workflow\n_What bash commands are usually run and in what order? How to interpret their output if not obvious?_\n\n# Errors & Corrections\n_Errors encountered and how they were fixed. What did the user correct? What approaches failed and should not be tried again?_\n\n# Codebase and System Documentation\n_What are the important system components? How do they work/fit together?_\n\n# Learnings\n_What has worked well? What has not? What to avoid? Do not duplicate items from other sections_\n\n# Key results\n_If the user asked a specific output such as an answer to a question, a table, or other document, repeat the exact result here_\n\n# Worklog\n_Step by step, what was attempted, done? Very terse summary for each step_\n";
/**
 * Load custom session memory template from file if it exists
 */
export declare function loadSessionMemoryTemplate(): Promise<string>;
/**
 * Load custom session memory prompt from file if it exists
 * Custom prompts can be placed at ~/.claude/session-memory/prompt.md
 * Use {{variableName}} syntax for variable substitution (e.g., {{currentNotes}}, {{notesPath}})
 */
export declare function loadSessionMemoryPrompt(): Promise<string>;
/**
 * Check if the session memory content is essentially empty (matches the template).
 * This is used to detect if no actual content has been extracted yet,
 * which means we should fall back to legacy compact behavior.
 */
export declare function isSessionMemoryEmpty(content: string): Promise<boolean>;
export declare function buildSessionMemoryUpdatePrompt(currentNotes: string, notesPath: string): Promise<string>;
/**
 * Truncate session memory sections that exceed the per-section token limit.
 * Used when inserting session memory into compact messages to prevent
 * oversized session memory from consuming the entire post-compact token budget.
 *
 * Returns the truncated content and whether any truncation occurred.
 */
export declare function truncateSessionMemoryForCompact(content: string): {
    truncatedContent: string;
    wasTruncated: boolean;
};
//# sourceMappingURL=prompts.d.ts.map