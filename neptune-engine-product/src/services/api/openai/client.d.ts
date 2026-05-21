import OpenAI from 'openai';
export declare function getOpenAIClient(options?: {
    maxRetries?: number;
    fetchOverride?: typeof fetch;
    source?: string;
}): OpenAI;
/** Clear the cached client (useful when env vars change). */
export declare function clearOpenAIClientCache(): void;
//# sourceMappingURL=client.d.ts.map