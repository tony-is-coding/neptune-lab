// builtin-tools — Tool implementations that belong to the Agent Runtime Kernel.
//
// This barrel file re-exports the runtime-side tools that remain in the
// engine workspace after the product-tool extraction (see
// docs/strategy/neptune-engine-decoupling-handover.md).
//
// Product-only tools that have been extracted to
// `neptune-engine-product/src/product-tools/<domain>/`:
//   - Plan-mode flow: AskUserQuestion, EnterPlanMode, ExitPlanMode (impl only;
//     ExitPlanMode/TeamCreate name constants stay in engine as protocol stubs).
//   - Browser/UI: WebBrowser.
//   - Task/Team/Schedule/Notify families: Task*, Team*, Schedule*, Send*,
//     Verify*, Monitor, Snip, CtxInspect, ToolSearch, Config, ListPeers,
//     PushNotification, TerminalCapture, TodoWrite, DiscoverSkills,
//     SyntheticOutput, OverflowTest, Tungsten, TestingPermission.
//
// Runtime tools that remain in engine: Agent, Bash, FileRead/FileWrite/
// FileEdit, Glob, Grep, NotebookEdit, LSP, MCP*, Skill, Sleep, REPL,
// SendMessage, TeamCreate (impl), WebFetch, WebSearch.

// =============================================================================
// Runtime-side tools that remain in engine
// =============================================================================
export {AgentTool} from './tools/AgentTool/AgentTool.js'
export {BashTool} from './tools/BashTool/BashTool.js'
export {FileEditTool} from './tools/FileEditTool/FileEditTool.js'
export {FileReadTool} from './tools/FileReadTool/FileReadTool.js'
export {FileWriteTool} from './tools/FileWriteTool/FileWriteTool.js'
export {GlobTool} from './tools/GlobTool/GlobTool.js'
export {GrepTool} from './tools/GrepTool/GrepTool.js'
export {LSPTool} from './tools/LSPTool/LSPTool.js'
export {ListMcpResourcesTool} from './tools/ListMcpResourcesTool/ListMcpResourcesTool.js'
export {ReadMcpResourceTool} from './tools/ReadMcpResourceTool/ReadMcpResourceTool.js'
export {NotebookEditTool} from './tools/NotebookEditTool/NotebookEditTool.js'
export {SkillTool} from './tools/SkillTool/SkillTool.js'
export {WebFetchTool} from './tools/WebFetchTool/WebFetchTool.js'
export {WebSearchTool} from './tools/WebSearchTool/WebSearchTool.js'

// Feature-gated runtime tools
export {REPLTool} from './tools/REPLTool/REPLTool.js'
export {SendMessageTool} from './tools/SendMessageTool/SendMessageTool.js'
export {SleepTool} from './tools/SleepTool/SleepTool.js'

// =============================================================================
// Runtime Kernel Protocol-backed tools
// (See docs/strategy/neptune-engine-runtime-kernel-design.md §10.2 — Phase B)
// These tools are thin shells over the Phase A protocols. Hosts inject the
// concrete protocol implementations via ctx.kernel; without injection, calls
// fail closed with a clear error. Default in-memory implementations live in
// `@neptune/engine` and are sufficient for SDK-style single-process agents.
// =============================================================================
export {
	DiscoverSkillsTool,
	DISCOVER_SKILLS_TOOL_NAME,
	MemoryRecallTool,
	MEMORY_RECALL_TOOL_NAME,
	MemoryWriteTool,
	MEMORY_WRITE_TOOL_NAME,
	TaskCreateTool,
	TASK_CREATE_TOOL_NAME,
	TaskGetTool,
	TASK_GET_TOOL_NAME,
	TaskListTool,
	TASK_LIST_TOOL_NAME,
	TaskOutputTool,
	TASK_OUTPUT_TOOL_NAME,
	TaskStopTool,
	TASK_STOP_TOOL_NAME,
	TaskUpdateTool,
	TASK_UPDATE_TOOL_NAME,
	TodoWriteTool,
	TODO_WRITE_TOOL_NAME,
	ToolSearchTool,
	TOOL_SEARCH_TOOL_NAME,
} from './tools/kernel/index.js'

export type {KernelProtocols, KernelToolContext} from './kernel-context.js'
export {KERNEL_CONTEXT_KEY, requireProtocol} from './kernel-context.js'

// Shared utilities
export {tagMessagesWithToolUseID, getToolUseIDFromParentMessage} from './tools/utils.js'
