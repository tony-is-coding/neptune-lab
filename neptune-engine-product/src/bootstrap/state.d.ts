import type { BetaMessageStreamParams } from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs';
import type { Attributes, Meter, MetricOptions } from '@opentelemetry/api';
import type { logs } from '@opentelemetry/api-logs';
import type { LoggerProvider } from '@opentelemetry/sdk-logs';
import type { MeterProvider } from '@opentelemetry/sdk-metrics';
import type { BasicTracerProvider } from '@opentelemetry/sdk-trace-base';
import type { HookEvent, ModelUsage } from 'src/entrypoints/agentSdkTypes.js';
import type { AgentColorName } from '@neptune/builtin-tools/tools/AgentTool/agentColorManager.js';
import type { HookCallbackMatcher } from 'src/types/hooks.js';
import type { ModelSetting } from 'src/utils/model/model.js';
import type { ModelStrings } from 'src/utils/model/modelStrings.js';
import type { SettingSource } from 'src/utils/settings/constants.js';
import type { PluginHookMatcher } from 'src/utils/settings/types.js';
type RegisteredHookMatcher = HookCallbackMatcher | PluginHookMatcher;
import type { SessionId } from 'src/types/ids.js';
export type ChannelEntry = {
    kind: 'plugin';
    name: string;
    marketplace: string;
    dev?: boolean;
} | {
    kind: 'server';
    name: string;
    dev?: boolean;
};
export type AttributedCounter = {
    add(value: number, additionalAttributes?: Attributes): void;
};
export declare function getSessionId(): SessionId;
export declare function regenerateSessionId(options?: {
    setCurrentAsParent?: boolean;
}): SessionId;
export declare function getParentSessionId(): SessionId | undefined;
/**
 * Atomically switch the active session. `sessionId` and `sessionProjectDir`
 * always change together — there is no separate setter for either, so they
 * cannot drift out of sync (CC-34).
 *
 * @param projectDir — directory containing `<sessionId>.jsonl`. Omit (or
 *   pass `null`) for sessions in the current project — the path will derive
 *   from originalCwd at read time. Pass `dirname(transcriptPath)` when the
 *   session lives in a different project directory (git worktrees,
 *   cross-project resume). Every call resets the project dir; it never
 *   carries over from the previous session.
 */
export declare function switchSession(sessionId: SessionId, projectDir?: string | null): void;
/**
 * Register a callback that fires when switchSession changes the active
 * sessionId. bootstrap can't import listeners directly (DAG leaf), so
 * callers register themselves. concurrentSessions.ts uses this to keep the
 * PID file's sessionId in sync with --resume.
 */
export declare const onSessionSwitch: any;
/**
 * Project directory the current session's transcript lives in, or `null` if
 * the session was created in the current project (common case — derive from
 * originalCwd). See `switchSession()`.
 */
export declare function getSessionProjectDir(): string | null;
export declare function getOriginalCwd(): string;
/**
 * Get the stable project root directory.
 * Unlike getOriginalCwd(), this is never updated by mid-session EnterWorktreeTool
 * (so skills/history stay stable when entering a throwaway worktree).
 * It IS set at startup by --worktree, since that worktree is the session's project.
 * Use for project identity (history, skills, sessions) not file operations.
 */
export declare function getProjectRoot(): string;
export declare function setOriginalCwd(cwd: string): void;
/**
 * Only for --worktree startup flag. Mid-session EnterWorktreeTool must NOT
 * call this — skills/history should stay anchored to where the session started.
 */
export declare function setProjectRoot(cwd: string): void;
export declare function getCwdState(): string;
export declare function setCwdState(cwd: string): void;
export declare function getDirectConnectServerUrl(): string | undefined;
export declare function setDirectConnectServerUrl(url: string): void;
export declare function addToTotalDurationState(duration: number, durationWithoutRetries: number): void;
export declare function resetTotalDurationStateAndCost_FOR_TESTS_ONLY(): void;
export declare function addToTotalCostState(cost: number, modelUsage: ModelUsage, model: string): void;
export declare function getTotalCostUSD(): number;
export declare function getTotalAPIDuration(): number;
export declare function getTotalDuration(): number;
export declare function getTotalAPIDurationWithoutRetries(): number;
export declare function getTotalToolDuration(): number;
export declare function addToToolDuration(duration: number): void;
export declare function getTurnHookDurationMs(): number;
export declare function addToTurnHookDuration(duration: number): void;
export declare function resetTurnHookDuration(): void;
export declare function getTurnHookCount(): number;
export declare function getTurnToolDurationMs(): number;
export declare function resetTurnToolDuration(): void;
export declare function getTurnToolCount(): number;
export declare function getTurnClassifierDurationMs(): number;
export declare function addToTurnClassifierDuration(duration: number): void;
export declare function resetTurnClassifierDuration(): void;
export declare function getTurnClassifierCount(): number;
export declare function getStatsStore(): {
    observe(name: string, value: number): void;
} | null;
export declare function setStatsStore(store: {
    observe(name: string, value: number): void;
} | null): void;
export declare function updateLastInteractionTime(immediate?: boolean): void;
/**
 * If an interaction was recorded since the last flush, update the timestamp
 * now. Called by Ink before each render cycle so we batch many keypresses into
 * a single Date.now() call.
 */
export declare function flushInteractionTime(): void;
export declare function addToTotalLinesChanged(added: number, removed: number): void;
export declare function getTotalLinesAdded(): number;
export declare function getTotalLinesRemoved(): number;
export declare function getTotalInputTokens(): number;
export declare function getTotalOutputTokens(): number;
export declare function getTotalCacheReadInputTokens(): number;
export declare function getTotalCacheCreationInputTokens(): number;
export declare function getTotalWebSearchRequests(): number;
export declare function getTurnOutputTokens(): number;
export declare function getCurrentTurnTokenBudget(): number | null;
export declare function snapshotOutputTokensForTurn(budget: number | null): void;
export declare function getBudgetContinuationCount(): number;
export declare function incrementBudgetContinuationCount(): void;
export declare function setHasUnknownModelCost(): void;
export declare function hasUnknownModelCost(): boolean;
export declare function getLastMainRequestId(): string | undefined;
export declare function setLastMainRequestId(requestId: string): void;
export declare function getLastApiCompletionTimestamp(): number | null;
export declare function setLastApiCompletionTimestamp(timestamp: number): void;
/** Mark that a compaction just occurred. The next API success event will
 *  include isPostCompaction=true, then the flag auto-resets. */
export declare function markPostCompaction(): void;
/** Consume the post-compaction flag. Returns true once after compaction,
 *  then returns false until the next compaction. */
export declare function consumePostCompaction(): boolean;
export declare function getLastInteractionTime(): number;
/** Mark that a scroll event just happened. Background intervals gate on
 *  getIsScrollDraining() and skip their work until the debounce clears. */
export declare function markScrollActivity(): void;
/** True while scroll is actively draining (within 150ms of last event).
 *  Intervals should early-return when this is set — the work picks up next
 *  tick after scroll settles. */
export declare function getIsScrollDraining(): boolean;
/** Await this before expensive one-shot work (network, subprocess) that could
 *  coincide with scroll. Resolves immediately if not scrolling; otherwise
 *  polls at the idle interval until the flag clears. */
export declare function waitForScrollIdle(): Promise<void>;
export declare function getModelUsage(): {
    [modelName: string]: ModelUsage;
};
export declare function getUsageForModel(model: string): ModelUsage | undefined;
/**
 * Gets the model override set from the --model CLI flag or after the user
 * updates their configured model.
 */
export declare function getMainLoopModelOverride(): ModelSetting | undefined;
export declare function getInitialMainLoopModel(): ModelSetting;
export declare function setMainLoopModelOverride(model: ModelSetting | undefined): void;
export declare function setInitialMainLoopModel(model: ModelSetting): void;
export declare function getSdkBetas(): string[] | undefined;
export declare function setSdkBetas(betas: string[] | undefined): void;
export declare function resetCostState(): void;
/**
 * Sets cost state values for session restore.
 * Called by restoreCostStateForSession in cost-tracker.ts.
 */
export declare function setCostStateForRestore({ totalCostUSD, totalAPIDuration, totalAPIDurationWithoutRetries, totalToolDuration, totalLinesAdded, totalLinesRemoved, lastDuration, modelUsage, }: {
    totalCostUSD: number;
    totalAPIDuration: number;
    totalAPIDurationWithoutRetries: number;
    totalToolDuration: number;
    totalLinesAdded: number;
    totalLinesRemoved: number;
    lastDuration: number | undefined;
    modelUsage: {
        [modelName: string]: ModelUsage;
    } | undefined;
}): void;
export declare function resetStateForTests(): void;
export declare function getModelStrings(): ModelStrings | null;
export declare function setModelStrings(modelStrings: ModelStrings): void;
export declare function resetModelStringsForTestingOnly(): void;
export declare function setMeter(meter: Meter, createCounter: (name: string, options: MetricOptions) => AttributedCounter): void;
export declare function getMeter(): Meter | null;
export declare function getSessionCounter(): AttributedCounter | null;
export declare function getLocCounter(): AttributedCounter | null;
export declare function getPrCounter(): AttributedCounter | null;
export declare function getCommitCounter(): AttributedCounter | null;
export declare function getCostCounter(): AttributedCounter | null;
export declare function getTokenCounter(): AttributedCounter | null;
export declare function getCodeEditToolDecisionCounter(): AttributedCounter | null;
export declare function getActiveTimeCounter(): AttributedCounter | null;
export declare function getLoggerProvider(): LoggerProvider | null;
export declare function setLoggerProvider(provider: LoggerProvider | null): void;
export declare function getEventLogger(): ReturnType<typeof logs.getLogger> | null;
export declare function setEventLogger(logger: ReturnType<typeof logs.getLogger> | null): void;
export declare function getMeterProvider(): MeterProvider | null;
export declare function setMeterProvider(provider: MeterProvider | null): void;
export declare function getTracerProvider(): BasicTracerProvider | null;
export declare function setTracerProvider(provider: BasicTracerProvider | null): void;
export declare function getIsNonInteractiveSession(): boolean;
export declare function getIsInteractive(): boolean;
export declare function setIsInteractive(value: boolean): void;
export declare function getClientType(): string;
export declare function setClientType(type: string): void;
export declare function getSdkAgentProgressSummariesEnabled(): boolean;
export declare function setSdkAgentProgressSummariesEnabled(value: boolean): void;
export declare function getKairosActive(): boolean;
export declare function setKairosActive(value: boolean): void;
export declare function getStrictToolResultPairing(): boolean;
export declare function setStrictToolResultPairing(value: boolean): void;
export declare function getUserMsgOptIn(): boolean;
export declare function setUserMsgOptIn(value: boolean): void;
export declare function getSessionSource(): string | undefined;
export declare function setSessionSource(source: string): void;
export declare function getQuestionPreviewFormat(): 'markdown' | 'html' | undefined;
export declare function setQuestionPreviewFormat(format: 'markdown' | 'html'): void;
export declare function getAgentColorMap(): Map<string, AgentColorName>;
export declare function getFlagSettingsPath(): string | undefined;
export declare function setFlagSettingsPath(path: string | undefined): void;
export declare function getFlagSettingsInline(): Record<string, unknown> | null;
export declare function setFlagSettingsInline(settings: Record<string, unknown> | null): void;
export declare function getSessionIngressToken(): string | null | undefined;
export declare function setSessionIngressToken(token: string | null): void;
export declare function getOauthTokenFromFd(): string | null | undefined;
export declare function setOauthTokenFromFd(token: string | null): void;
export declare function getApiKeyFromFd(): string | null | undefined;
export declare function setApiKeyFromFd(key: string | null): void;
export declare function setLastAPIRequest(params: Omit<BetaMessageStreamParams, 'messages'> | null): void;
export declare function getLastAPIRequest(): Omit<BetaMessageStreamParams, 'messages'> | null;
export declare function setLastAPIRequestMessages(messages: BetaMessageStreamParams['messages'] | null): void;
export declare function getLastAPIRequestMessages(): BetaMessageStreamParams['messages'] | null;
export declare function setLastClassifierRequests(requests: unknown[] | null): void;
export declare function getLastClassifierRequests(): unknown[] | null;
export declare function setCachedClaudeMdContent(content: string | null): void;
export declare function getCachedClaudeMdContent(): string | null;
export declare function addToInMemoryErrorLog(errorInfo: {
    error: string;
    timestamp: string;
}): void;
export declare function getAllowedSettingSources(): SettingSource[];
export declare function setAllowedSettingSources(sources: SettingSource[]): void;
export declare function preferThirdPartyAuthentication(): boolean;
export declare function setInlinePlugins(plugins: Array<string>): void;
export declare function getInlinePlugins(): Array<string>;
export declare function setChromeFlagOverride(value: boolean | undefined): void;
export declare function getChromeFlagOverride(): boolean | undefined;
export declare function setUseCoworkPlugins(value: boolean): void;
export declare function getUseCoworkPlugins(): boolean;
export declare function setSessionBypassPermissionsMode(enabled: boolean): void;
export declare function getSessionBypassPermissionsMode(): boolean;
export declare function setScheduledTasksEnabled(enabled: boolean): void;
export declare function getScheduledTasksEnabled(): boolean;
export type SessionCronTask = {
    id: string;
    cron: string;
    prompt: string;
    createdAt: number;
    recurring?: boolean;
    /**
     * When set, the task was created by an in-process teammate (not the team lead).
     * The scheduler routes fires to that teammate's pendingUserMessages queue
     * instead of the main REPL command queue. Session-only — never written to disk.
     */
    agentId?: string;
};
export declare function getSessionCronTasks(): SessionCronTask[];
export declare function addSessionCronTask(task: SessionCronTask): void;
/**
 * Returns the number of tasks actually removed. Callers use this to skip
 * downstream work (e.g. the disk read in removeCronTasks) when all ids
 * were accounted for here.
 */
export declare function removeSessionCronTasks(ids: readonly string[]): number;
export declare function setSessionTrustAccepted(accepted: boolean): void;
export declare function getSessionTrustAccepted(): boolean;
export declare function setSessionPersistenceDisabled(disabled: boolean): void;
export declare function isSessionPersistenceDisabled(): boolean;
export declare function hasExitedPlanModeInSession(): boolean;
export declare function setHasExitedPlanMode(value: boolean): void;
export declare function needsPlanModeExitAttachment(): boolean;
export declare function setNeedsPlanModeExitAttachment(value: boolean): void;
export declare function handlePlanModeTransition(fromMode: string, toMode: string): void;
export declare function needsAutoModeExitAttachment(): boolean;
export declare function setNeedsAutoModeExitAttachment(value: boolean): void;
export declare function handleAutoModeTransition(fromMode: string, toMode: string): void;
export declare function hasShownLspRecommendationThisSession(): boolean;
export declare function setLspRecommendationShownThisSession(value: boolean): void;
export declare function setInitJsonSchema(schema: Record<string, unknown>): void;
export declare function getInitJsonSchema(): Record<string, unknown> | null;
export declare function registerHookCallbacks(hooks: Partial<Record<HookEvent, RegisteredHookMatcher[]>>): void;
export declare function getRegisteredHooks(): Partial<Record<HookEvent, RegisteredHookMatcher[]>> | null;
export declare function clearRegisteredHooks(): void;
export declare function clearRegisteredPluginHooks(): void;
export declare function resetSdkInitState(): void;
export declare function getPlanSlugCache(): Map<string, string>;
export declare function getSessionCreatedTeams(): Set<string>;
export declare function setTeleportedSessionInfo(info: {
    sessionId: string | null;
}): void;
export declare function getTeleportedSessionInfo(): {
    isTeleported: boolean;
    hasLoggedFirstMessage: boolean;
    sessionId: string | null;
} | null;
export declare function markFirstTeleportMessageLogged(): void;
export type InvokedSkillInfo = {
    skillName: string;
    skillPath: string;
    content: string;
    invokedAt: number;
    agentId: string | null;
};
export declare function addInvokedSkill(skillName: string, skillPath: string, content: string, agentId?: string | null): void;
export declare function getInvokedSkills(): Map<string, InvokedSkillInfo>;
export declare function getInvokedSkillsForAgent(agentId: string | undefined | null): Map<string, InvokedSkillInfo>;
export declare function clearInvokedSkills(preservedAgentIds?: ReadonlySet<string>): void;
export declare function clearInvokedSkillsForAgent(agentId: string): void;
export declare function addSlowOperation(operation: string, durationMs: number): void;
export declare function getSlowOperations(): ReadonlyArray<{
    operation: string;
    durationMs: number;
    timestamp: number;
}>;
export declare function getMainThreadAgentType(): string | undefined;
export declare function setMainThreadAgentType(agentType: string | undefined): void;
export declare function getIsRemoteMode(): boolean;
export declare function setIsRemoteMode(value: boolean): void;
export declare function getSystemPromptSectionCache(): Map<string, string | null>;
export declare function setSystemPromptSectionCacheEntry(name: string, value: string | null): void;
export declare function clearSystemPromptSectionState(): void;
export declare function getLastEmittedDate(): string | null;
export declare function setLastEmittedDate(date: string | null): void;
export declare function getAdditionalDirectoriesForClaudeMd(): string[];
export declare function setAdditionalDirectoriesForClaudeMd(directories: string[]): void;
export declare function getAllowedChannels(): ChannelEntry[];
export declare function setAllowedChannels(entries: ChannelEntry[]): void;
export declare function getHasDevChannels(): boolean;
export declare function setHasDevChannels(value: boolean): void;
export declare function getPromptCache1hAllowlist(): string[] | null;
export declare function setPromptCache1hAllowlist(allowlist: string[] | null): void;
export declare function getPromptCache1hEligible(): boolean | null;
export declare function setPromptCache1hEligible(eligible: boolean | null): void;
export declare function getAfkModeHeaderLatched(): boolean | null;
export declare function setAfkModeHeaderLatched(v: boolean): void;
export declare function getFastModeHeaderLatched(): boolean | null;
export declare function setFastModeHeaderLatched(v: boolean): void;
export declare function getCacheEditingHeaderLatched(): boolean | null;
export declare function setCacheEditingHeaderLatched(v: boolean): void;
export declare function getThinkingClearLatched(): boolean | null;
export declare function setThinkingClearLatched(v: boolean): void;
/**
 * Reset beta header latches to null. Called on /clear and /compact so a
 * fresh conversation gets fresh header evaluation.
 */
export declare function clearBetaHeaderLatches(): void;
export declare function getPromptId(): string | null;
export declare function setPromptId(id: string | null): void;
export declare function isReplBridgeActive(): boolean;
export {};
//# sourceMappingURL=state.d.ts.map