export declare const ALL_AGENT_DISALLOWED_TOOLS: Set<string>;
export declare const CUSTOM_AGENT_DISALLOWED_TOOLS: Set<string>;
export declare const ASYNC_AGENT_ALLOWED_TOOLS: Set<string>;
/**
 * Tools allowed only for in-process teammates (not general async agents).
 * These are injected by inProcessRunner.ts and allowed through filterToolsForAgent
 * via isInProcessTeammate() check.
 */
export declare const IN_PROCESS_TEAMMATE_ALLOWED_TOOLS: Set<string>;
/**
 * Tools allowed in coordinator mode - only output and agent management tools for the coordinator
 */
export declare const COORDINATOR_MODE_ALLOWED_TOOLS: Set<string>;
//# sourceMappingURL=tools.d.ts.map