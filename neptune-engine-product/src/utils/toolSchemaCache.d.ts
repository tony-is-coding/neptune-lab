import type { BetaTool } from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs';
type CachedSchema = BetaTool & {
    strict?: boolean;
    eager_input_streaming?: boolean;
};
export declare function getToolSchemaCache(): Map<string, CachedSchema>;
export declare function clearToolSchemaCache(): void;
export {};
//# sourceMappingURL=toolSchemaCache.d.ts.map