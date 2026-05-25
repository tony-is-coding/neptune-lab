/**
 * NotebookEditTool name constant — substrate stub for Stage B0.
 *
 * 设计目的：
 * - NotebookEditTool 主体（Jupyter / .ipynb 业务）已迁出到
 *   neptune-engine-product/src/cc-tools/NotebookEditTool/（红线 #4 列为 product 业务）。
 * - 但 substrate 内 FileEditTool / REPLTool 需要按名字识别 .ipynb 文件路径
 *   并提示 LLM 改用 NotebookEdit；这里只保留 name 常量作为 protocol stub。
 * - 不会有 ToolDef 实现 —— substrate 不绑 Jupyter 业务。
 */

export const NOTEBOOK_EDIT_TOOL_NAME = 'NotebookEdit'
