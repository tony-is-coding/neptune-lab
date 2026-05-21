import type { AppState } from '../../state/AppState.js';
import type { Message } from '../../types/message.js';
import { type CacheSafeParams } from '../../utils/forkedAgent.js';
import type { REPLHookContext } from '../../utils/hooks/postSamplingHooks.js';
import { getLastAssistantMessage } from '../../utils/messages.js';
export type PromptVariant = 'user_intent' | 'stated_intent';
export declare function getPromptVariant(): PromptVariant;
export declare function shouldEnablePromptSuggestion(): boolean;
export declare function abortPromptSuggestion(): void;
/**
 * Returns a suppression reason if suggestions should not be generated,
 * or null if generation is allowed. Shared by main and pipelined paths.
 */
export declare function getSuggestionSuppressReason(appState: AppState): string | null;
/**
 * Shared guard + generation logic used by both CLI TUI and SDK push paths.
 * Returns the suggestion with metadata, or null if suppressed/filtered.
 */
export declare function tryGenerateSuggestion(abortController: AbortController, messages: Message[], getAppState: () => AppState, cacheSafeParams: CacheSafeParams, source?: 'cli' | 'sdk'): Promise<{
    suggestion: string;
    promptId: PromptVariant;
    generationRequestId: string | null;
} | null>;
export declare function executePromptSuggestion(context: REPLHookContext): Promise<void>;
export declare function getParentCacheSuppressReason(lastAssistantMessage: ReturnType<typeof getLastAssistantMessage>): string | null;
export declare function generateSuggestion(abortController: AbortController, promptId: PromptVariant, cacheSafeParams: CacheSafeParams): Promise<{
    suggestion: string | null;
    generationRequestId: string | null;
}>;
export declare function shouldFilterSuggestion(suggestion: string | null, promptId: PromptVariant, source?: 'cli' | 'sdk'): boolean;
/**
 * Log acceptance/ignoring of a prompt suggestion. Used by the SDK push path
 * to track outcomes when the next user message arrives.
 */
export declare function logSuggestionOutcome(suggestion: string, userInput: string, emittedAt: number, promptId: PromptVariant, generationRequestId: string | null): void;
export declare function logSuggestionSuppressed(reason: string, suggestion?: string, promptId?: PromptVariant, source?: 'cli' | 'sdk'): void;
//# sourceMappingURL=promptSuggestion.d.ts.map