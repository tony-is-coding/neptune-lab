// figures-core.ts - SDK 核心常量（不含 CLI 专用常量）
//
// 这些常量是 SDK 功能必需的：
// - BLOCKQUOTE_BAR: markdown 渲染需要
// - PAUSE_ICON: 权限模式显示需要
// - LIGHTNING_BOLT: 快速模式标识需要
// - DIAMOND_OPEN/FILLED: 任务状态显示需要

import {env} from '../utils/env.js'

// 通用图标常量（平台适配）
export const BLACK_CIRCLE = env.platform === 'darwin' ? '⏺' : '●'
export const BULLET_OPERATOR = '∙'
export const TEARDROP_ASTERISK = '✻'
export const UP_ARROW = '\u2191' // ↑
export const DOWN_ARROW = '\u2193' // ↓
export const LIGHTNING_BOLT = '↯' // \u21af - 快速模式指示器

// 努力级别指示器
export const EFFORT_LOW = '○' // \u25cb
export const EFFORT_MEDIUM = '◐' // \u25d0
export const EFFORT_HIGH = '●' // \u25cf
export const EFFORT_MAX = '◉' // \u25c9

// 媒体/触发器状态指示器
export const PLAY_ICON = '\u25b6' // ▶
export const PAUSE_ICON = '\u23f8' // ⏸

// MCP 订阅指示器
export const REFRESH_ARROW = '\u21bb' // ↻
export const CHANNEL_ARROW = '\u2190' // ←
export const INJECTED_ARROW = '\u2192' // →
export const FORK_GLYPH = '\u2442' // ⑂

// 审查状态指示器 (ultrareview diamond states)
export const DIAMOND_OPEN = '\u25c7' // ◇ - 运行中
export const DIAMOND_FILLED = '\u25c6' // ◆ - 已完成/失败
export const REFERENCE_MARK = '\u203b' // ※

// 问题标记指示器
export const FLAG_ICON = '\u2691' // ⚑

// 引用指示器
export const BLOCKQUOTE_BAR = '\u258e' // ▎ - 左四分之一块，用作引用线前缀
export const HEAVY_HORIZONTAL = '\u2501' // ━ - 重型水平框线
