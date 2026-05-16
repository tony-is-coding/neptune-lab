import {feature} from 'bun:bundle'
import React, {
	useContext,
	useEffect,
	useState,
	useSyncExternalStore,
} from 'react'
import {EngineState} from '../engine/EngineState.js'

// DCE: voice context is ant-only. External builds get a passthrough.
/* eslint-disable @typescript-eslint/no-require-imports */
const VoiceProvider: (props: { children: React.ReactNode }) => React.ReactNode =
	feature('VOICE_MODE')
		? require('../context/voice.js').VoiceProvider
		: ({children}) => children

/* eslint-enable @typescript-eslint/no-require-imports */

// 从纯 JS 函数导入类型和默认值
import {
	type AppState,
	type AppStateStore,
	getDefaultAppState,
} from './AppStateStore.js'
// 从纯 JS 函数导入 createAppStateStore
import {createAppStateStore} from './createAppStateStore.js'

// TODO: Remove these re-exports once all callers import directly from
// ./AppStateStore.js. Kept for back-compat during migration so .ts callers
// can incrementally move off the .tsx import and stop pulling React.
export {
	type AppState,
	type AppStateStore,
	type CompletionBoundary,
	getDefaultAppState,
	IDLE_SPECULATION_STATE,
	type SpeculationResult,
	type SpeculationState,
} from './AppStateStore.js'

// 导出纯 JS 函数供 SDK 使用
export {createAppStateStore} from './createAppStateStore.js'

export const AppStoreContext = React.createContext<AppStateStore | null>(null)

// 内部 MailboxContext - 解耦对 context/mailbox.tsx 的依赖
const MailboxContext = React.createContext<Mailbox | undefined>(undefined)

// 导入 Mailbox 类型（用于类型注解）
import type {Mailbox} from '../utils/mailbox.js'

/**
 * useMailbox - 获取 Mailbox 实例（从 AppState）
 *
 * 重新导出 Mailbox 访问器，替代 context/mailbox.tsx 中的 useMailbox。
 * 这样 AppState 不再依赖外部 context 文件。
 */
export function useMailbox(): Mailbox | undefined {
	return useContext(MailboxContext)
}

type Props = {
	children: React.ReactNode
	initialState?: AppState
	onChangeAppState?: (args: { newState: AppState; oldState: AppState }) => void
}

const HasAppStateContext = React.createContext<boolean>(false)

export function AppStateProvider({
									 children,
									 initialState,
									 onChangeAppState,
								 }: Props): React.ReactNode {
	// Don't allow nested AppStateProviders.
	const hasAppStateContext = useContext(HasAppStateContext)
	if (hasAppStateContext) {
		throw new Error(
			'AppStateProvider can not be nested within another AppStateProvider',
		)
	}

	// 使用纯 JS 函数创建 store 和 mailbox（从 createAppStateStore 提取）
	// Store is created once and never changes -- stable context value means
	// the provider never triggers re-renders. Consumers subscribe to slices
	// via useSyncExternalStore in useAppState(selector).
	const {store, mailbox, cleanup} = useState(() =>
		createAppStateStore(
			initialState ?? getDefaultAppState(),
			onChangeAppState,
		),
	)[0]

	// 在组件卸载时清理订阅
	useEffect(() => cleanup, [cleanup])

	return (
		<HasAppStateContext.Provider value={true}>
			<AppStoreContext.Provider value={store}>
				<MailboxContext.Provider value={mailbox}>
					<VoiceProvider>{children}</VoiceProvider>
				</MailboxContext.Provider>
			</AppStoreContext.Provider>
		</HasAppStateContext.Provider>
	)
}

function useAppStore(): AppStateStore {
	// eslint-disable-next-line react-hooks/rules-of-hooks
	const store = useContext(AppStoreContext)
	if (!store) {
		throw new ReferenceError(
			'useAppState/useSetAppState cannot be called outside of an <AppStateProvider />',
		)
	}
	return store
}

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
export function useAppState<T>(selector: (state: AppState) => T): T {
	const store = useAppStore()

	const get = () => {
		const state = store.getState()
		const selected = selector(state)

		if (process.env.USER_TYPE === 'ant' && state === selected) {
			throw new Error(
				`Your selector in \`useAppState(${selector.toString()})\` returned the original state, which is not allowed. You must instead return a property for optimised rendering.`,
			)
		}

		return selected
	}

	return useSyncExternalStore(store.subscribe, get, get)
}

/**
 * Get the setAppState updater without subscribing to any state.
 * Returns a stable reference that never changes -- components using only
 * this hook will never re-render from state changes.
 */
export function useSetAppState(): (
	updater: (prev: AppState) => AppState,
) => void {
	return useAppStore().setState
}

/**
 * Get the store directly (for passing getState/setState to non-React code).
 */
export function useAppStateStore(): AppStateStore {
	return useAppStore()
}

/**
 * Get the EngineState instance directly.
 *
 * EngineState contains core runtime state (A 类字段) that can be used
 * independently of React. This is useful for headless/SDK/server scenarios.
 *
 * @returns The EngineState instance associated with the current AppStateProvider
 * @throws ReferenceError if called outside of an AppStateProvider
 */
export function useEngineState(): EngineState {
	return useAppStore().getEngineState()
}

const NOOP_SUBSCRIBE = () => () => {
}

/**
 * Safe version of useAppState that returns undefined if called outside of AppStateProvider.
 * Useful for components that may be rendered in contexts where AppStateProvider isn't available.
 */
export function useAppStateMaybeOutsideOfProvider<T>(
	selector: (state: AppState) => T,
): T | undefined {
	const store = useContext(AppStoreContext)
	return useSyncExternalStore(store ? store.subscribe : NOOP_SUBSCRIBE, () =>
		store ? selector(store.getState()) : undefined,
	)
}
