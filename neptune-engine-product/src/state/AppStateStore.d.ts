import type { BaseNotification } from '../types/notification.js';
export type { BaseNotification };
export type { NotificationPriority } from '../types/notification.js';
export interface CoreNotification extends BaseNotification {
    text: string;
    color?: string;
}
export type Notification = CoreNotification;
import type { TodoList } from 'src/utils/todo/types.js';
import type { BridgePermissionCallbacks } from '../types/bridge.js';
import type { Command } from '../commands.js';
import type { ChannelPermissionCallbacks } from '../services/mcp/channelPermissions.js';
import type { ElicitationRequestEvent } from '../services/mcp/elicitationHandler.js';
import type { MCPServerConnection, ServerResource } from '../services/mcp/types.js';
import { type Tool, type ToolPermissionContext } from '../Tool.js';
import type { TaskState } from '../tasks/types.js';
import type { AgentColorName } from '@neptune/builtin-tools/tools/AgentTool/agentColorManager.js';
import type { AgentDefinitionsResult } from '@neptune/builtin-tools/tools/AgentTool/loadAgentsDir.js';
import type { AllowedPrompt } from '@neptune/builtin-tools/tools/ExitPlanModeTool/ExitPlanModeV2Tool.js';
import type { AgentId } from '../types/ids.js';
import type { Message, UserMessage } from '../types/message.js';
import type { LoadedPlugin, PluginError } from '../types/plugin.js';
import type { DeepImmutable } from '../types/utils.js';
import { type AttributionState } from '../utils/commitAttribution.js';
import type { EffortValue } from '../utils/effort.js';
import type { FileHistoryState } from '../utils/fileHistory.js';
import type { REPLHookContext } from '../utils/hooks/postSamplingHooks.js';
import type { SessionHooksState } from '../utils/hooks/sessionHooks.js';
import type { ModelSetting } from '../utils/model/model.js';
import type { DenialTrackingState } from '../utils/permissions/denialTracking.js';
import type { PermissionMode } from '../utils/permissions/PermissionMode.js';
import type { SettingsJson } from '../utils/settings/types.js';
import type { Store } from './store.js';
export type CompletionBoundary = {
    type: 'complete';
    completedAt: number;
    outputTokens: number;
} | {
    type: 'bash';
    command: string;
    completedAt: number;
} | {
    type: 'edit';
    toolName: string;
    filePath: string;
    completedAt: number;
} | {
    type: 'denied_tool';
    toolName: string;
    detail: string;
    completedAt: number;
};
export type SpeculationResult = {
    messages: Message[];
    boundary: CompletionBoundary | null;
    timeSavedMs: number;
};
export type SpeculationState = {
    status: 'idle';
} | {
    status: 'active';
    id: string;
    abort: () => void;
    startTime: number;
    messagesRef: {
        current: Message[];
    };
    writtenPathsRef: {
        current: Set<string>;
    };
    boundary: CompletionBoundary | null;
    suggestionLength: number;
    toolUseCount: number;
    isPipelined: boolean;
    contextRef: {
        current: REPLHookContext;
    };
    pipelinedSuggestion?: {
        text: string;
        promptId: 'user_intent' | 'stated_intent';
        generationRequestId: string | null;
    } | null;
};
export declare const IDLE_SPECULATION_STATE: SpeculationState;
export type FooterItem = 'tasks' | 'tmux' | 'bagel' | 'teams' | 'bridge';
export type AppState = DeepImmutable<{
    settings: SettingsJson;
    verbose: boolean;
    mainLoopModel: ModelSetting;
    mainLoopModelForSession: ModelSetting;
    statusLineText: string | undefined;
    expandedView: 'none' | 'tasks' | 'teammates';
    isBriefOnly: boolean;
    showTeammateMessagePreview?: boolean;
    selectedIPAgentIndex: number;
    coordinatorTaskIndex: number;
    viewSelectionMode: 'none' | 'selecting-agent' | 'viewing-agent';
    footerSelection: FooterItem | null;
    toolPermissionContext: ToolPermissionContext;
    spinnerTip?: string;
    agent: string | undefined;
    kairosEnabled: boolean;
    remoteSessionUrl: string | undefined;
    remoteConnectionStatus: 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
    remoteBackgroundTaskCount: number;
    replBridgeEnabled: boolean;
    replBridgeExplicit: boolean;
    replBridgeOutboundOnly: boolean;
    replBridgeConnected: boolean;
    replBridgeSessionActive: boolean;
    replBridgeReconnecting: boolean;
    replBridgeConnectUrl: string | undefined;
    replBridgeSessionUrl: string | undefined;
    replBridgeEnvironmentId: string | undefined;
    replBridgeSessionId: string | undefined;
    replBridgeError: string | undefined;
    replBridgeInitialName: string | undefined;
    showRemoteCallout: boolean;
}> & {
    tasks: {
        [taskId: string]: TaskState;
    };
    agentNameRegistry: Map<string, AgentId>;
    foregroundedTaskId?: string;
    viewingAgentTaskId?: string;
    mcp: {
        clients: MCPServerConnection[];
        tools: Tool[];
        commands: Command[];
        resources: Record<string, ServerResource[]>;
        /**
         * Incremented by /reload-plugins to trigger MCP effects to re-run
         * and pick up newly-enabled plugin MCP servers. Effects read this
         * as a dependency; the value itself is not consumed.
         */
        pluginReconnectKey: number;
    };
    plugins: {
        enabled: LoadedPlugin[];
        disabled: LoadedPlugin[];
        commands: Command[];
        /**
         * Plugin system errors collected during loading and initialization.
         * See {@link PluginError} type documentation for complete details on error
         * structure, context fields, and display format.
         */
        errors: PluginError[];
        installationStatus: {
            marketplaces: Array<{
                name: string;
                status: 'pending' | 'installing' | 'installed' | 'failed';
                error?: string;
            }>;
            plugins: Array<{
                id: string;
                name: string;
                status: 'pending' | 'installing' | 'installed' | 'failed';
                error?: string;
            }>;
        };
        /**
         * Set to true when plugin state on disk has changed (background reconcile,
         * /plugin menu install, external settings edit) and active components are
         * stale. In interactive mode, user runs /reload-plugins to consume. In
         * headless mode, refreshPluginState() auto-consumes via refreshActivePlugins().
         */
        needsRefresh: boolean;
    };
    agentDefinitions: AgentDefinitionsResult;
    fileHistory: FileHistoryState;
    attribution: AttributionState;
    todos: {
        [agentId: string]: TodoList;
    };
    remoteAgentTaskSuggestions: {
        summary: string;
        task: string;
    }[];
    notifications: {
        current: any;
        queue: any[];
    };
    elicitation: {
        queue: ElicitationRequestEvent[];
    };
    thinkingEnabled: boolean | undefined;
    promptSuggestionEnabled: boolean;
    sessionHooks: SessionHooksState;
    tungstenActiveSession?: {
        sessionName: string;
        socketName: string;
        target: string;
    };
    tungstenLastCapturedTime?: number;
    tungstenLastCommand?: {
        command: string;
        timestamp: number;
    };
    tungstenPanelVisible?: boolean;
    tungstenPanelAutoHidden?: boolean;
    bagelActive?: boolean;
    bagelUrl?: string;
    bagelPanelVisible?: boolean;
    computerUseMcpState?: {
        allowedApps?: readonly {
            bundleId: string;
            displayName: string;
            grantedAt: number;
        }[];
        grantFlags?: {
            clipboardRead: boolean;
            clipboardWrite: boolean;
            systemKeyCombos: boolean;
        };
        lastScreenshotDims?: {
            width: number;
            height: number;
            displayWidth: number;
            displayHeight: number;
            displayId?: number;
            originX?: number;
            originY?: number;
        };
        hiddenDuringTurn?: ReadonlySet<string>;
        selectedDisplayId?: number;
        displayPinnedByModel?: boolean;
        displayResolvedForApps?: string;
    };
    replContext?: {
        vmContext: import('vm').Context;
        registeredTools: Map<string, {
            name: string;
            description: string;
            schema: Record<string, unknown>;
            handler: (args: Record<string, unknown>) => Promise<unknown>;
        }>;
        console: {
            log: (...args: unknown[]) => void;
            error: (...args: unknown[]) => void;
            warn: (...args: unknown[]) => void;
            info: (...args: unknown[]) => void;
            debug: (...args: unknown[]) => void;
            getStdout: () => string;
            getStderr: () => string;
            clear: () => void;
        };
    };
    teamContext?: {
        teamName: string;
        teamFilePath: string;
        leadAgentId: string;
        selfAgentId?: string;
        selfAgentName?: string;
        isLeader?: boolean;
        selfAgentColor?: string;
        teammates: {
            [teammateId: string]: {
                name: string;
                agentType?: string;
                color?: string;
                tmuxSessionName: string;
                tmuxPaneId: string;
                cwd: string;
                worktreePath?: string;
                spawnedAt: number;
            };
        };
    };
    standaloneAgentContext?: {
        name: string;
        color?: AgentColorName;
    };
    inbox: {
        messages: Array<{
            id: string;
            from: string;
            text: string;
            timestamp: string;
            status: 'pending' | 'processing' | 'processed';
            color?: string;
            summary?: string;
        }>;
    };
    workerSandboxPermissions: {
        queue: Array<{
            requestId: string;
            workerId: string;
            workerName: string;
            workerColor?: string;
            host: string;
            createdAt: number;
        }>;
        selectedIndex: number;
    };
    pendingWorkerRequest: {
        toolName: string;
        toolUseId: string;
        description: string;
    } | null;
    pendingSandboxRequest: {
        requestId: string;
        host: string;
    } | null;
    promptSuggestion: {
        text: string | null;
        promptId: 'user_intent' | 'stated_intent' | null;
        shownAt: number;
        acceptedAt: number;
        generationRequestId: string | null;
    };
    speculation: SpeculationState;
    speculationSessionTimeSavedMs: number;
    skillImprovement: {
        suggestion: {
            skillName: string;
            updates: {
                section: string;
                change: string;
                reason: string;
            }[];
        } | null;
    };
    authVersion: number;
    initialMessage: {
        message: UserMessage;
        clearContext?: boolean;
        mode?: PermissionMode;
        allowedPrompts?: AllowedPrompt[];
    } | null;
    pendingPlanVerification?: {
        plan: string;
        verificationStarted: boolean;
        verificationCompleted: boolean;
    };
    denialTracking?: DenialTrackingState;
    activeOverlays: ReadonlySet<string>;
    fastMode?: boolean;
    advisorModel?: string;
    effortValue?: EffortValue;
    ultraplanLaunching?: boolean;
    ultraplanSessionUrl?: string;
    ultraplanPendingChoice?: {
        plan: string;
        sessionId: string;
        taskId: string;
    };
    ultraplanLaunchPending?: {
        blurb: string;
    };
    isUltraplanMode?: boolean;
    replBridgePermissionCallbacks?: BridgePermissionCallbacks;
    channelPermissionCallbacks?: ChannelPermissionCallbacks;
};
export type AppStateStore = Store<AppState>;
export declare function getDefaultAppState(): AppState;
//# sourceMappingURL=AppStateStore.d.ts.map