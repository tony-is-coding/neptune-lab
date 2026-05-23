// TungstenTool: Anthropic-internal tmux-backed virtual terminal tool.
//
// This file is a typed stub. The runtime implementation lives in the
// Anthropic-internal build and is selected through `USER_TYPE === 'ant'`
// gating in the product tool registry. External engine builds keep the
// stub so the registry can compile without conditional imports.
import type {Tool} from '../../Tool.js'

export const TungstenTool: Tool = (() => {
}) as unknown as Tool

export const clearSessionsWithTungstenUsage: () => void = () => {}
export const resetInitializationState: () => void = () => {}
