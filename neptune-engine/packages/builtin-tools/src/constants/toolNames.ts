// Centralized tool name constants for the Agent Runtime Kernel.
//
// These strings are part of the **engine ↔ model protocol** — they are how
// the engine refers to a tool when building system prompts and parsing tool
// calls. They are intentionally split away from each tool's implementation
// so that:
//
//   1. `AgentTool/built-in/*Agent.ts` and other prompt builders can reference
//      them without forcing the underlying tool implementation to live in the
//      engine workspace.
//   2. Product-side tools (Plan-mode, Team*, etc.) whose **implementations**
//      live under `neptune-engine-product/src/product-tools/<domain>/` still
//      have a stable name that the engine can mention by string.
//
// Do not duplicate these strings in tool implementations; import from here.

export const ASK_USER_QUESTION_TOOL_NAME = 'AskUserQuestion'
export const ENTER_PLAN_MODE_TOOL_NAME = 'EnterPlanMode'
export const EXIT_PLAN_MODE_TOOL_NAME = 'ExitPlanMode'
// V2 happens to share the same wire name; kept separate for forward
// compatibility with future v2-only behavior.
export const EXIT_PLAN_MODE_V2_TOOL_NAME = 'ExitPlanMode'
export const TEAM_CREATE_TOOL_NAME = 'TeamCreate'
