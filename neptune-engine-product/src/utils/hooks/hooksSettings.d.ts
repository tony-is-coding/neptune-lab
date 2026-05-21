import type { HookEvent } from 'src/entrypoints/agentSdkTypes.js';
import type { AppState } from '../../state/AppState.js';
import type { EditableSettingSource } from '../settings/constants.js';
import type { HookCommand } from '../settings/types.js';
export type HookSource = EditableSettingSource | 'policySettings' | 'pluginHook' | 'sessionHook' | 'builtinHook';
export interface IndividualHookConfig {
    event: HookEvent;
    config: HookCommand;
    matcher?: string;
    source: HookSource;
    pluginName?: string;
}
/**
 * Check if two hooks are equal (comparing only command/prompt content, not timeout)
 */
export declare function isHookEqual(a: HookCommand | {
    type: 'function';
    timeout?: number;
}, b: HookCommand | {
    type: 'function';
    timeout?: number;
}): boolean;
/** Get the display text for a hook */
export declare function getHookDisplayText(hook: HookCommand | {
    type: 'callback' | 'function';
    statusMessage?: string;
}): string;
export declare function getAllHooks(appState: AppState): IndividualHookConfig[];
export declare function getHooksForEvent(appState: AppState, event: HookEvent): IndividualHookConfig[];
export declare function hookSourceDescriptionDisplayString(source: HookSource): string;
export declare function hookSourceHeaderDisplayString(source: HookSource): string;
export declare function hookSourceInlineDisplayString(source: HookSource): string;
export declare function sortMatchersByPriority(matchers: string[], hooksByEventAndMatcher: Record<string, Record<string, IndividualHookConfig[]>>, selectedEvent: HookEvent): string[];
//# sourceMappingURL=hooksSettings.d.ts.map