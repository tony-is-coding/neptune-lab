import type { Message } from '../types/message.js';
type TokenStats = {
    toolRequests: Map<string, number>;
    toolResults: Map<string, number>;
    humanMessages: number;
    assistantMessages: number;
    localCommandOutputs: number;
    other: number;
    attachments: Map<string, number>;
    duplicateFileReads: Map<string, {
        count: number;
        tokens: number;
    }>;
    total: number;
};
export declare function analyzeContext(messages: Message[]): TokenStats;
export declare function tokenStatsToStatsigMetrics(stats: TokenStats): Record<string, number>;
export {};
//# sourceMappingURL=contextAnalysis.d.ts.map