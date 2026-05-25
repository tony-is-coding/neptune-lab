import type {Tool} from '../../tool.js'
import {BashTool} from '../BashTool/BashTool.js'
import {FileEditTool} from '../FileEditTool/FileEditTool.js'
import {FileReadTool} from '../FileReadTool/FileReadTool.js'
import {FileWriteTool} from '../FileWriteTool/FileWriteTool.js'
import {GlobTool} from '../GlobTool/GlobTool.js'
import {GrepTool} from '../GrepTool/GrepTool.js'

let _primitiveTools: readonly Tool[] | undefined

/**
 * Primitive tools hidden from direct model use when REPL mode is on
 * (REPL_ONLY_TOOLS) but still accessible inside the REPL VM context.
 * Exported so display-side code (collapseReadSearch, renderers) can
 * classify/render virtual messages for these tools even when they're
 * absent from the filtered execution tools list.
 *
 * Lazy getter — the import chain collapseReadSearch.ts → primitiveTools.ts
 * → FileReadTool.tsx → ... loops back through the tool registry, so a
 * top-level const hits "Cannot access before initialization". Deferring
 * to call time avoids the TDZ.
 *
 * Referenced directly rather than via getAllBaseTools() because that
 * excludes Glob/Grep when hasEmbeddedSearchTools() is true.
 *
 * Stage B0 (2026-05-25):
 * - Removed AgentTool / NotebookEditTool from this list — both are not yet
 *   available in substrate as ToolDef:
 *     · AgentTool 主体由 Stage B2 在 packages/builtin-tools/src/tools/AgentTool/
 *       补齐 ~2700 行薄壳后会自动重新加入这里
 *     · NotebookEditTool 整体保留 product（红线 #4 列为业务），不会回到 substrate
 * - 当 REPL VM 内需要 spawn sub-agent 时，应通过 host 注入而非 primitive 工具列表
 *   引用（B2 完成后 product CLI 再连回这层）。
 */
export function getReplPrimitiveTools(): readonly Tool[] {
	return (_primitiveTools ??= [
		FileReadTool,
		FileWriteTool,
		FileEditTool,
		GlobTool,
		GrepTool,
		BashTool,
	])
}
