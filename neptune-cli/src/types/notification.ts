/**
 * Notification 类型定义 — CLI 特定
 *
 * 扩展框架核心的 Notification 类型，添加 JSX 和 Theme 支持。
 */

import type * as React from 'react'
import type { Theme } from 'claude-code-best/utils/theme.js'
import type {
  BaseNotification,
  NotificationPriority,
} from 'claude-code-best/types/notification.js'

// 重新导出核心类型
export type { NotificationPriority } from 'claude-code-best/types/notification.js'

// CLI 特定的 TextNotification，扩展核心类型添加 Theme 类型的 color
export interface TextNotification extends BaseNotification {
  text: string
  color?: keyof Theme
}

// CLI 专用的 JSXNotification（含 React 依赖）
export interface JSXNotification extends BaseNotification {
  jsx: React.ReactNode
}

// CLI 使用的完整 Notification 类型（Text + JSX）
export type Notification = TextNotification | JSXNotification
