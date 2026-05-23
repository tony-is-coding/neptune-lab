import type { HookResultMessage } from '../types/message.js';
type SessionStartHooksOptions = {
    sessionId?: string;
    agentType?: string;
    model?: string;
    forceSyncExecution?: boolean;
};
export declare function takeInitialUserMessage(): string | undefined;
export declare function processSessionStartHooks(source: 'startup' | 'resume' | 'clear' | 'compact', { sessionId, agentType, model, forceSyncExecution, }?: SessionStartHooksOptions): Promise<HookResultMessage[]>;
export declare function processSetupHooks(trigger: 'init' | 'maintenance', { forceSyncExecution }?: {
    forceSyncExecution?: boolean;
}): Promise<HookResultMessage[]>;
export {};
//# sourceMappingURL=sessionStart.d.ts.map