import OpenAI from 'openai';
export declare function getGrokClient(options?: {
    maxRetries?: number;
    fetchOverride?: typeof fetch;
    source?: string;
}): OpenAI;
export declare function clearGrokClientCache(): void;
//# sourceMappingURL=client.d.ts.map