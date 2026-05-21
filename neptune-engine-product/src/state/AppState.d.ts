import React from 'react';
import { EngineState } from '../engine/EngineState.js';
import { type AppState, type AppStateStore } from './AppStateStore.js';
export { type AppState, type AppStateStore, type CompletionBoundary, getDefaultAppState, IDLE_SPECULATION_STATE, type SpeculationResult, type SpeculationState, } from './AppStateStore.js';
export { createAppStateStore } from './createAppStateStore.js';
export declare const AppStoreContext: React.Context<AppStateStore>;
import type { Mailbox } from '../utils/mailbox.js';
/**
 * useMailbox - 获取 Mailbox 实例（从 AppState）
 *
 * 重新导出 Mailbox 访问器，替代 context/mailbox.tsx 中的 useMailbox。
 * 这样 AppState 不再依赖外部 context 文件。
 */
export declare function useMailbox(): Mailbox | undefined;
type Props = {
    children: React.ReactNode;
    initialState?: AppState;
    onChangeAppState?: (args: {
        newState: AppState;
        oldState: AppState;
    }) => void;
};
export declare function AppStateProvider({ children, initialState, onChangeAppState, }: Props): React.ReactNode;
/**
 * Subscribe to a slice of AppState. Only re-renders when the selected value
 * changes (compared via Object.is).
 *
 * For multiple independent fields, call the hook multiple times:
 * ```
 * const verbose = useAppState(s => s.verbose)
 * const model = useAppState(s => s.mainLoopModel)
 * ```
 *
 * Do NOT return new objects from the selector -- Object.is will always see
 * them as changed. Instead, select an existing sub-object reference:
 * ```
 * const { text, promptId } = useAppState(s => s.promptSuggestion) // good
 * ```
 */
export declare function useAppState<T>(selector: (state: AppState) => T): T;
/**
 * Get the setAppState updater without subscribing to any state.
 * Returns a stable reference that never changes -- components using only
 * this hook will never re-render from state changes.
 */
export declare function useSetAppState(): (updater: (prev: AppState) => AppState) => void;
/**
 * Get the store directly (for passing getState/setState to non-React code).
 */
export declare function useAppStateStore(): AppStateStore;
/**
 * Get the EngineState instance directly.
 *
 * EngineState contains core runtime state (A 类字段) that can be used
 * independently of React. This is useful for headless/SDK/server scenarios.
 *
 * @returns The EngineState instance associated with the current AppStateProvider
 * @throws ReferenceError if called outside of an AppStateProvider
 */
export declare function useEngineState(): EngineState;
/**
 * Safe version of useAppState that returns undefined if called outside of AppStateProvider.
 * Useful for components that may be rendered in contexts where AppStateProvider isn't available.
 */
export declare function useAppStateMaybeOutsideOfProvider<T>(selector: (state: AppState) => T): T | undefined;
//# sourceMappingURL=AppState.d.ts.map