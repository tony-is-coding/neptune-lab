import type { GeminiGenerateContentRequest, GeminiStreamChunk } from './types.js';
export declare function streamGeminiGenerateContent(params: {
    model: string;
    body: GeminiGenerateContentRequest;
    signal: AbortSignal;
    fetchOverride?: typeof fetch;
}): AsyncGenerator<GeminiStreamChunk, void>;
//# sourceMappingURL=client.d.ts.map