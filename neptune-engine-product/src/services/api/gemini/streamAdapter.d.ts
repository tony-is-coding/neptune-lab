import type { BetaRawMessageStreamEvent } from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs';
import type { GeminiStreamChunk } from './types.js';
export declare function adaptGeminiStreamToAnthropic(stream: AsyncIterable<GeminiStreamChunk>, model: string): AsyncGenerator<BetaRawMessageStreamEvent, void>;
//# sourceMappingURL=streamAdapter.d.ts.map