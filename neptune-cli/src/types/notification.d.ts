/**
 * Notification 类型扩展 — CLI 特定
 *
 * 扩展框架核心的 Notification 类型，添加 JSX 支持。
 * 通过模块扩展（module augmentation）实现，避免修改核心代码。
 */

import type * as React from 'react'
import type { Theme } from 'claude-code-best/utils/theme.js'

// 扩展核心的 BaseNotification 类型
declare module 'claude-code-best/types/notification' {
  export interface BaseNotification {
    // 不添加新字段，只是让 TypeScript 知道这个接口可以被扩展
  }

  // 扩展核心的 Notification 类型
  export type Notification =
    | (TextNotification & { color?: keyof Theme })
    | JSXNotification

  export interface TextNotification {
    text: string
    color?: keyof Theme
  }

  export interface JSXNotification {
    jsx: React.ReactNode
  }
}
