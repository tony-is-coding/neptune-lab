/**
 * @neptune/engine/testing — substrate 测试工具子入口
 *
 * 设计目的（v6.0 P0.4.E）：
 * - substrate 提供给 user / examples / product 测试场景的 mock 工具
 * - 与主 entry `@neptune/engine` 分开，避免污染生产代码 import surface
 *
 * 包含：
 * - ScriptedProvider — 测试用 mock provider，按顺序产出预设的 SSE 流
 * - textTurn / toolUseTurn / errorTurn — 便捷 fixture builders
 *
 * 使用：
 * ```ts
 * import {ScriptedProvider, textTurn} from '@neptune/engine/testing'
 *
 * const provider = new ScriptedProvider([
 *   textTurn('Hello world'),
 *   textTurn('Second turn'),
 * ])
 * ```
 */
export {
	ScriptedProvider,
	textTurn,
	toolUseTurn,
	errorTurn,
} from '../agent-loop/loop/__tests__/scriptedProvider.js'
