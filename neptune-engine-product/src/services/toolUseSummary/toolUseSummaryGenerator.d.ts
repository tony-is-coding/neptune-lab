/**
 * Tool Use Summary Generator
 *
 * Generates human-readable summaries of completed tool batches using Haiku.
 * Used by the SDK to provide high-level progress updates to clients.
 */
type ToolInfo = {
    name: string;
    input: unknown;
    output: unknown;
};
export type GenerateToolUseSummaryParams = {
    tools: ToolInfo[];
    signal: AbortSignal;
    isNonInteractiveSession: boolean;
    lastAssistantText?: string;
};
/**
 * Generates a human-readable summary of completed tools.
 *
 * @param params - Parameters including tools executed and their results
 * @returns A brief summary string, or null if generation fails
 */
export declare function generateToolUseSummary({ tools, signal, isNonInteractiveSession, lastAssistantText, }: GenerateToolUseSummaryParams): Promise<string | null>;
export {};
//# sourceMappingURL=toolUseSummaryGenerator.d.ts.map