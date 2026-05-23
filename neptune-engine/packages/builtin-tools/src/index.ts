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

// Shared utilities
export {tagMessagesWithToolUseID, getToolUseIDFromParentMessage} from './tools/utils.js'
