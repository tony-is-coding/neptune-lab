export {};
import type { Message } from 'src/types/message';
export declare const isSnipMarkerMessage: (message: Message) => boolean;
export declare const snipCompactIfNeeded: (messages: Message[], options?: {
    force?: boolean;
}) => {
    messages: Message[];
    executed: boolean;
    tokensFreed: number;
    boundaryMessage?: Message;
};
export declare const isSnipRuntimeEnabled: () => boolean;
export declare const shouldNudgeForSnips: (messages: Message[]) => boolean;
export declare const SNIP_NUDGE_TEXT: string;
//# sourceMappingURL=snipCompact.d.ts.map