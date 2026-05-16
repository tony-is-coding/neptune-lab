// @cli-only - figures.ts 包含所有图标常量（包括 CLI 专用）
//
// SDK 核心文件应该使用 figures-core.ts，只有 CLI 专用文件才需要这里的完整常量
//
// 导出 SDK 核心常量
export * from './figures-core.js'

// CLI 专用常量：Bridge 状态指示器
// 这些是 Bridge/Remote Control 功能专用的，SDK 不需要

export const BRIDGE_SPINNER_FRAMES = [
	'\u00b7|\u00b7',
	'\u00b7/\u00b7',
	'\u00b7\u2014\u00b7',
	'\u00b7\\\u00b7',
]
export const BRIDGE_READY_INDICATOR = '\u00b7\u2714\ufe0e\u00b7'
export const BRIDGE_FAILED_INDICATOR = '\u00d7'
