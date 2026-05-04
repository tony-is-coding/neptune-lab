/**
 * createAppStateStore - 纯 JS 版本的 AppState 状态创建函数
 *
 * 提供 SDK/Headless 路径：不依赖 React，可直接调用获取 store 和 mailbox。
 * React Provider 路径通过 AppStateProvider 内部调用此函数。
 *
 * @module state/createAppStateStore
 */

import { logForDebugging } from '../utils/debug.js'
import { Mailbox } from '../utils/mailbox.js'
import {
  createDisabledBypassPermissionsContext,
  isBypassPermissionsModeDisabled,
} from '../utils/permissions/permissionSetup.js'
import { applySettingsChange } from '../utils/settings/applySettingsChange.js'
import { settingsChangeDetector } from '../utils/settings/changeDetector.js'
import type { SettingSource } from '../utils/settings/constants.js'
import type { Store } from './store.js'
import { createStore } from './store.js'
import {
  type AppState,
  type AppStateStore,
  getDefaultAppState,
} from './AppStateStore.js'

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
export function createAppStateStore(
  initialState?: AppState,
  onChange?: (args: { newState: AppState; oldState: AppState }) => void,
): {
  store: AppStateStore
  mailbox: Mailbox
  cleanup: () => void
} {
  // 1. 创建 store（从 useState L89-94 提取）
  const store = createStore<AppState>(
    initialState ?? getDefaultAppState(),
    onChange,
  )

  // 2. bypass permissions 检查（从 useEffect L101-118 提取为同步函数）
  // 处理竞态条件：远程设置可能在组件挂载前加载完成
  const checkBypassPermissionsOnMount = () => {
    const { toolPermissionContext } = store.getState()
    if (
      toolPermissionContext.isBypassPermissionsModeAvailable &&
      isBypassPermissionsModeDisabled()
    ) {
      logForDebugging(
        'Disabling bypass permissions mode on mount (remote settings loaded before mount)',
      )
      store.setState((prev) => ({
        ...prev,
        toolPermissionContext: createDisabledBypassPermissionsContext(
          prev.toolPermissionContext,
        ),
      }))
    }
  }
  checkBypassPermissionsOnMount()

  // 3. settings 变更监听（从 useEffect L129 + useCallback L123 提取）
  const onSettingsChange = (source: SettingSource) => {
    applySettingsChange(source, store.setState)
  }
  const unsubscribeSettings = settingsChangeDetector.subscribe(onSettingsChange)

  // 4. 创建 Mailbox 实例（从 useMemo L135 提取）
  const mailbox = new Mailbox()

  // 5. cleanup 函数用于清理订阅
  const cleanup = () => {
    unsubscribeSettings()
  }

  return {
    store,
    mailbox,
    cleanup,
  }
}

// 从 AppStateStore 重新导出类型和函数，方便单一导入
export type { AppState, AppStateStore }
export { getDefaultAppState }
