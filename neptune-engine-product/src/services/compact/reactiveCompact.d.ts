export {};
import type { Message } from 'src/types/message';
import type { CompactionResult } from './compact.js';
export declare const isReactiveOnlyMode: () => boolean;
export declare const reactiveCompactOnPromptTooLong: (messages: Message[], cacheSafeParams: Record<string, unknown>, options: {
    customInstructions?: string;
    trigger?: string;
}) => Promise<{
    ok: boolean;
    reason?: string;
    result?: CompactionResult;
}>;
export declare const isReactiveCompactEnabled: () => boolean;
export declare const isWithheldPromptTooLong: (message: Message) => boolean;
export declare const isWithheldMediaSizeError: (message: Message) => boolean;
export declare const tryReactiveCompact: (params: {
    hasAttempted: boolean;
    querySource: string;
    aborted: boolean;
    messages: Message[];
    cacheSafeParams: Record<string, unknown>;
}) => Promise<CompactionResult | null>;
//# sourceMappingURL=reactiveCompact.d.ts.map