/**
 * AppState 类型扩展 — CLI 特定
 *
 * 扩展框架核心的 AppState 类型，将 notifications 字段替换为包含 JSX 的版本。
 */

import type { Notification } from './notification.js'

declare module 'claude-code-best/state/AppStateStore' {
  export interface AppState {
    notifications: {
      current: Notification | null
      queue: Notification[]
    }
  }
}
