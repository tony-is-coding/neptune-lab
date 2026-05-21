import type { ClientOptions } from '@anthropic-ai/sdk';
export declare function getLastApiRequests(): Array<{
    timestamp: string;
    request: unknown;
}>;
export declare function clearApiRequestCache(): void;
export declare function clearDumpState(agentIdOrSessionId: string): void;
export declare function clearAllDumpState(): void;
export declare function addApiRequestToCache(requestData: unknown): void;
export declare function getDumpPromptsPath(agentIdOrSessionId?: string): string;
export declare function createDumpPromptsFetch(agentIdOrSessionId: string): ClientOptions['fetch'];
//# sourceMappingURL=dumpPrompts.d.ts.map