import type { BetaToolUnion } from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs';
import type { GeminiFunctionCallingConfig, GeminiTool } from './types.js';
export declare function anthropicToolsToGemini(tools: BetaToolUnion[]): GeminiTool[];
export declare function anthropicToolChoiceToGemini(toolChoice: unknown): GeminiFunctionCallingConfig | undefined;
//# sourceMappingURL=convertTools.d.ts.map