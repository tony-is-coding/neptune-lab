import { type AppState, type SpeculationResult, type SpeculationState } from '../../state/AppStateStore.js';
import type { Message } from '../../types/message.js';
import { type FileStateCache } from '../../utils/fileStateCache.js';
import { type CacheSafeParams } from '../../utils/forkedAgent.js';
import type { REPLHookContext } from '../../utils/hooks/postSamplingHooks.js';
import type { SetAppState } from '../../utils/messageQueueManager.js';
export type ActiveSpeculationState = Extract<SpeculationState, {
    status: 'active';
}>;
export declare function prepareMessagesForInjection(messages: Message[]): Message[];
export declare function isSpeculationEnabled(): boolean;
export declare function startSpeculation(suggestionText: string, context: REPLHookContext, setAppState: (f: (prev: AppState) => AppState) => void, isPipelined?: boolean, cacheSafeParams?: CacheSafeParams): Promise<void>;
export declare function acceptSpeculation(state: SpeculationState, setAppState: (f: (prev: AppState) => AppState) => void, cleanMessageCount: number): Promise<SpeculationResult | null>;
export declare function abortSpeculation(setAppState: SetAppState): void;
export declare function handleSpeculationAccept(speculationState: ActiveSpeculationState, speculationSessionTimeSavedMs: number, setAppState: SetAppState, input: string, deps: {
    setMessages: (f: (prev: Message[]) => Message[]) => void;
    readFileState: {
        current: FileStateCache;
    };
    cwd: string;
}): Promise<{
    queryRequired: boolean;
}>;
//# sourceMappingURL=speculation.d.ts.map