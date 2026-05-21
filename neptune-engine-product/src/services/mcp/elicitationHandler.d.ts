import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { type ElicitRequestParams, type ElicitResult } from '@modelcontextprotocol/sdk/types.js';
import type { AppState } from '../../state/AppState.js';
/** Configuration for the waiting state shown after the user opens a URL. */
export type ElicitationWaitingState = {
    /** Button label, e.g. "Retry now" or "Skip confirmation" */
    actionLabel: string;
    /** Whether to show a visible Cancel button (e.g. for error-based retry flow) */
    showCancel?: boolean;
};
export type ElicitationRequestEvent = {
    serverName: string;
    /** The JSON-RPC request ID, unique per server connection. */
    requestId: string | number;
    params: ElicitRequestParams;
    signal: AbortSignal;
    /**
     * Resolves the elicitation. For explicit elicitations, all actions are
     * meaningful. For error-based retry (-32042), 'accept' is a no-op —
     * the retry is driven by onWaitingDismiss instead.
     */
    respond: (response: ElicitResult) => void;
    /** For URL elicitations: shown after user opens the browser. */
    waitingState?: ElicitationWaitingState;
    /** Called when phase 2 (waiting) is dismissed by user action or completion. */
    onWaitingDismiss?: (action: 'dismiss' | 'retry' | 'cancel') => void;
    /** Set to true by the completion notification handler when the server confirms completion. */
    completed?: boolean;
};
export declare function registerElicitationHandler(client: Client, serverName: string, setAppState: (f: (prevState: AppState) => AppState) => void): void;
export declare function runElicitationHooks(serverName: string, params: ElicitRequestParams, signal: AbortSignal): Promise<ElicitResult | undefined>;
/**
 * Run ElicitationResult hooks after the user has responded, then fire a
 * `elicitation_response` notification. Returns a (potentially modified)
 * ElicitResult — hooks may override the action/content or block the response.
 */
export declare function runElicitationResultHooks(serverName: string, result: ElicitResult, signal: AbortSignal, mode?: 'form' | 'url', elicitationId?: string): Promise<ElicitResult>;
//# sourceMappingURL=elicitationHandler.d.ts.map