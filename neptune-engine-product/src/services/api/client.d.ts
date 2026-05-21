import Anthropic, { type ClientOptions } from '@anthropic-ai/sdk';
export declare function getAnthropicClient({ apiKey, maxRetries, model, fetchOverride, source, }: {
    apiKey?: string;
    maxRetries: number;
    model?: string;
    fetchOverride?: ClientOptions['fetch'];
    source?: string;
}): Promise<Anthropic>;
export declare const CLIENT_REQUEST_ID_HEADER = "x-client-request-id";
//# sourceMappingURL=client.d.ts.map