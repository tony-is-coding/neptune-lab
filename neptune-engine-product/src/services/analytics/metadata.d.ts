/**
 * Shared event metadata enrichment for analytics systems
 *
 * This module provides a single source of truth for collecting and formatting
 * event metadata across all analytics systems (Datadog, 1P).
 */
import type { CoreUserData } from 'src/utils/user.js';
import type { EnvironmentMetadata } from '../../types/generated/events_mono/claude_code/v1/claude_code_internal_event.js';
import type { PublicApiAuth } from '../../types/generated/events_mono/common/v1/auth.js';
/**
 * Marker type for verifying analytics metadata doesn't contain sensitive data
 *
 * This type forces explicit verification that string values being logged
 * don't contain code snippets, file paths, or other sensitive information.
 *
 * The metadata is expected to be JSON-serializable.
 *
 * Usage: `myString as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS`
 *
 * The type is `never` which means it can never actually hold a value - this is
 * intentional as it's only used for type-casting to document developer intent.
 */
export type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS = never;
/**
 * Sanitizes tool names for analytics logging to avoid PII exposure.
 *
 * MCP tool names follow the format `mcp__<server>__<tool>` and can reveal
 * user-specific server configurations, which is considered PII-medium.
 * This function redacts MCP tool names while preserving built-in tool names
 * (Bash, Read, Write, etc.) which are safe to log.
 *
 * @param toolName - The tool name to sanitize
 * @returns The original name for built-in tools, or 'mcp_tool' for MCP tools
 */
export declare function sanitizeToolNameForAnalytics(toolName: string): AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS;
/**
 * Check if detailed tool name logging is enabled for OTLP events.
 * When enabled, MCP server/tool names and Skill names are logged.
 * Disabled by default to protect PII (user-specific server configurations).
 *
 * Enable with OTEL_LOG_TOOL_DETAILS=1
 */
export declare function isToolDetailsLoggingEnabled(): boolean;
/**
 * Check if detailed tool name logging (MCP server/tool names) is enabled
 * for analytics events.
 *
 * Per go/taxonomy, MCP names are medium PII. We log them for:
 * - Cowork (entrypoint=local-agent) — no ZDR concept, log all MCPs
 * - claude.ai-proxied connectors — always official (from claude.ai's list)
 * - Servers whose URL matches the official MCP registry — directory
 *   connectors added via `claude mcp add`, not customer-specific config
 *
 * Custom/user-configured MCPs stay sanitized (toolName='mcp_tool').
 */
export declare function isAnalyticsToolDetailsLoggingEnabled(mcpServerType: string | undefined, mcpServerBaseUrl: string | undefined): boolean;
/**
 * Spreadable helper for logEvent payloads — returns {mcpServerName, mcpToolName}
 * if the gate passes, empty object otherwise. Consolidates the identical IIFE
 * pattern at each tengu_tool_use_* call site.
 */
export declare function mcpToolDetailsForAnalytics(toolName: string, mcpServerType: string | undefined, mcpServerBaseUrl: string | undefined): {
    mcpServerName?: AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS;
    mcpToolName?: AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS;
};
/**
 * Extract MCP server and tool names from a full MCP tool name.
 * MCP tool names follow the format: mcp__<server>__<tool>
 *
 * @param toolName - The full tool name (e.g., 'mcp__slack__read_channel')
 * @returns Object with serverName and toolName, or undefined if not an MCP tool
 */
export declare function extractMcpToolDetails(toolName: string): {
    serverName: AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS;
    mcpToolName: AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS;
} | undefined;
/**
 * Extract skill name from Skill tool input.
 *
 * @param toolName - The tool name (should be 'Skill')
 * @param input - The tool input containing the skill name
 * @returns The skill name if this is a Skill tool call, undefined otherwise
 */
export declare function extractSkillName(toolName: string, input: unknown): AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS | undefined;
/**
 * Serialize a tool's input arguments for the OTel tool_result event.
 * Truncates long strings and deep nesting to keep the output bounded while
 * preserving forensically useful fields like file paths, URLs, and MCP args.
 * Returns undefined when OTEL_LOG_TOOL_DETAILS is not enabled.
 */
export declare function extractToolInputForTelemetry(input: unknown): string | undefined;
/**
 * Extracts and sanitizes a file extension for analytics logging.
 *
 * Uses Node's path.extname for reliable cross-platform extension extraction.
 * Returns 'other' for extensions exceeding MAX_FILE_EXTENSION_LENGTH to avoid
 * logging potentially sensitive data (like hash-based filenames).
 *
 * @param filePath - The file path to extract the extension from
 * @returns The sanitized extension, 'other' for long extensions, or undefined if no extension
 */
export declare function getFileExtensionForAnalytics(filePath: string): AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS | undefined;
/**
 * Extracts file extensions from a bash command for analytics.
 * Best-effort: splits on operators and whitespace, extracts extensions
 * from non-flag args of allowed commands. No heavy shell parsing needed
 * because grep patterns and sed scripts rarely resemble file extensions.
 */
export declare function getFileExtensionsFromBashCommand(command: string, simulatedSedEditFilePath?: string): AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS | undefined;
/**
 * Environment context metadata
 */
export type EnvContext = {
    platform: string;
    platformRaw: string;
    arch: string;
    nodeVersion: string;
    terminal: string | null;
    packageManagers: string;
    runtimes: string;
    isRunningWithBun: boolean;
    isCi: boolean;
    isClaubbit: boolean;
    isClaudeCodeRemote: boolean;
    isLocalAgentMode: boolean;
    isConductor: boolean;
    remoteEnvironmentType?: string;
    coworkerType?: string;
    claudeCodeContainerId?: string;
    claudeCodeRemoteSessionId?: string;
    tags?: string;
    isGithubAction: boolean;
    isClaudeCodeAction: boolean;
    isClaudeAiAuth: boolean;
    version: string;
    versionBase?: string;
    buildTime: string;
    deploymentEnvironment: string;
    githubEventName?: string;
    githubActionsRunnerEnvironment?: string;
    githubActionsRunnerOs?: string;
    githubActionRef?: string;
    wslVersion?: string;
    linuxDistroId?: string;
    linuxDistroVersion?: string;
    linuxKernel?: string;
    vcs?: string;
};
/**
 * Process metrics included with all analytics events.
 */
export type ProcessMetrics = {
    uptime: number;
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
    constrainedMemory: number | undefined;
    cpuUsage: NodeJS.CpuUsage;
    cpuPercent: number | undefined;
};
/**
 * Core event metadata shared across all analytics systems
 */
export type EventMetadata = {
    model: string;
    sessionId: string;
    userType: string;
    betas?: string;
    envContext: EnvContext;
    entrypoint?: string;
    agentSdkVersion?: string;
    isInteractive: string;
    clientType: string;
    processMetrics?: ProcessMetrics;
    sweBenchRunId: string;
    sweBenchInstanceId: string;
    sweBenchTaskId: string;
    agentId?: string;
    parentSessionId?: string;
    agentType?: 'teammate' | 'subagent' | 'standalone';
    teamName?: string;
    subscriptionType?: string;
    rh?: string;
    kairosActive?: true;
    skillMode?: 'discovery' | 'coach' | 'discovery_and_coach';
    observerMode?: 'backseat' | 'skillcoach' | 'both';
};
/**
 * Options for enriching event metadata
 */
export type EnrichMetadataOptions = {
    model?: unknown;
    betas?: unknown;
    additionalMetadata?: Record<string, unknown>;
};
/**
 * Get core event metadata shared across all analytics systems.
 *
 * This function collects environment, runtime, and context information
 * that should be included with all analytics events.
 *
 * @param options - Configuration options
 * @returns Promise resolving to enriched metadata object
 */
export declare function getEventMetadata(options?: EnrichMetadataOptions): Promise<EventMetadata>;
/**
 * Core event metadata for 1P event logging (snake_case format).
 */
export type FirstPartyEventLoggingCoreMetadata = {
    session_id: string;
    model: string;
    user_type: string;
    betas?: string;
    entrypoint?: string;
    agent_sdk_version?: string;
    is_interactive: boolean;
    client_type: string;
    swe_bench_run_id?: string;
    swe_bench_instance_id?: string;
    swe_bench_task_id?: string;
    agent_id?: string;
    parent_session_id?: string;
    agent_type?: 'teammate' | 'subagent' | 'standalone';
    team_name?: string;
};
/**
 * Complete event logging metadata format for 1P events.
 */
export type FirstPartyEventLoggingMetadata = {
    env: EnvironmentMetadata;
    process?: string;
    auth?: PublicApiAuth;
    core: FirstPartyEventLoggingCoreMetadata;
    additional: Record<string, unknown>;
};
/**
 * Convert metadata to 1P event logging format (snake_case fields).
 *
 * The /api/event_logging/batch endpoint expects snake_case field names
 * for environment and core metadata.
 *
 * @param metadata - Core event metadata
 * @param additionalMetadata - Additional metadata to include
 * @returns Metadata formatted for 1P event logging
 */
export declare function to1PEventFormat(metadata: EventMetadata, userMetadata: CoreUserData, additionalMetadata?: Record<string, unknown>): FirstPartyEventLoggingMetadata;
//# sourceMappingURL=metadata.d.ts.map