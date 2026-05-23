import type { PartialCompactDirection } from '../../types/message.js';
export declare function getPartialCompactPrompt(customInstructions?: string, direction?: PartialCompactDirection): string;
export declare function getCompactPrompt(customInstructions?: string): string;
/**
 * Formats the compact summary by stripping the <analysis> drafting scratchpad
 * and replacing <summary> XML tags with readable section headers.
 * @param summary The raw summary string potentially containing <analysis> and <summary> XML tags
 * @returns The formatted summary with analysis stripped and summary tags replaced by headers
 */
export declare function formatCompactSummary(summary: string): string;
export declare function getCompactUserSummaryMessage(summary: string, suppressFollowUpQuestions?: boolean, transcriptPath?: string, recentMessagesPreserved?: boolean): string;
//# sourceMappingURL=prompt.d.ts.map