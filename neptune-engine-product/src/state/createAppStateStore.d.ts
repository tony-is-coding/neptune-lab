/**
 * createAppStateStore - 纯 JS 版本的 AppState 状态创建函数
 *
 * 提供 SDK/Headless 路径：不依赖 React，可直接调用获取 store 和 mailbox。
 * React Provider 路径通过 AppStateProvider 内部调用此函数。
 *
 * @module state/createAppStateStore
 */
import { Mailbox } from '../utils/mailbox.js';
import { type AppState, type AppStateStore, getDefaultAppState } from './AppStateStore.js';
/**
 * 创建 AppState store 和相关实例的纯 JS 函数
 *
 * 此函数提取自 AppStateProvider 的核心逻辑，提供非 React 路径的
 * 状态初始化能力。SDK 可直接调用此函数创建 store，无需 React 依赖。
 *
 * @param initialState - 可选的初始状态，默认使用 getDefaultAppState()
 * @param onChange - 可选的状态变更回调
 * @returns 包含 store、mailbox 和 cleanup 函数的对象
 *
 * @example
 * ```ts
 * import { createAppStateStore } from 'claude-code/state'
 *
 * const { store, mailbox, cleanup } = createAppStateStore(undefined, (args) => {
 *   console.log('State changed:', args.newState)
 * })
 * ```
 */
export declare function createAppStateStore(initialState?: AppState, onChange?: (args: {
    newState: AppState;
    oldState: AppState;
}) => void): {
    store: AppStateStore;
    mailbox: Mailbox;
    cleanup: () => void;
};
export type { AppState, AppStateStore };
export { getDefaultAppState };
//# sourceMappingURL=createAppStateStore.d.ts.map