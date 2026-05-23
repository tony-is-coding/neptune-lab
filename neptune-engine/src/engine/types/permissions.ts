/**
 * engine/types/permissions.ts — Permission types (engine self-contained definition)
 *
 * Inlined from product to break reverse dependency.
 * No bun:bundle feature flags — engine uses hardcoded static arrays.
 * CanUseToolFn references Tool/ToolUseContext from engine-product (still a K-DEFAULT debt,
 * will be resolved in stage 2 B-class split).
 */

import type {ContentBlockParam} from '@anthropic-ai/sdk/resources/messages.mjs'
import type {AssistantMessage} from './message.js'

// ============================================================================
// Permission Modes
// ============================================================================

export const EXTERNAL_PERMISSION_MODES = [
	'acceptEdits',
	'bypassPermissions',
	'default',
	'dontAsk',
	'plan',
] as const

export type ExternalPermissionMode = (typeof EXTERNAL_PERMISSION_MODES)[number]

export type InternalPermissionMode = ExternalPermissionMode | 'auto' | 'bubble'
export type PermissionMode = InternalPermissionMode

// Engine hardcodes without bun:bundle feature flag.
// Product layer may include 'auto' conditionally via its own feature flag.
export const INTERNAL_PERMISSION_MODES: readonly PermissionMode[] = [
	...EXTERNAL_PERMISSION_MODES,
] as const

export const PERMISSION_MODES = INTERNAL_PERMISSION_MODES

// ============================================================================
// Permission Behaviors
// ============================================================================

export type PermissionBehavior = 'allow' | 'deny' | 'ask'

// ============================================================================
// Permission Rules
// ============================================================================

export type PermissionRuleSource =
	| 'userSettings'
	| 'projectSettings'
	| 'localSettings'
	| 'flagSettings'
	| 'policySettings'
	| 'cliArg'
	| 'command'
	| 'session'

export type PermissionRuleValue = {
	toolName: string
	ruleContent?: string
}

export type PermissionRule = {
	source: PermissionRuleSource
	ruleBehavior: PermissionBehavior
	ruleValue: PermissionRuleValue
}

// ============================================================================
// Permission Updates
// ============================================================================

export type PermissionUpdateDestination =
	| 'userSettings'
	| 'projectSettings'
	| 'localSettings'
	| 'session'
	| 'cliArg'

export type PermissionUpdate =
	| {
			type: 'addRules'
			destination: PermissionUpdateDestination
			rules: PermissionRuleValue[]
			behavior: PermissionBehavior
	  }
	| {
			type: 'replaceRules'
			destination: PermissionUpdateDestination
			rules: PermissionRuleValue[]
			behavior: PermissionBehavior
	  }
	| {
			type: 'removeRules'
			destination: PermissionUpdateDestination
			rules: PermissionRuleValue[]
			behavior: PermissionBehavior
	  }
	| {
			type: 'setMode'
			destination: PermissionUpdateDestination
			mode: ExternalPermissionMode
	  }
	| {
			type: 'addDirectories'
			destination: PermissionUpdateDestination
			directories: string[]
	  }
	| {
			type: 'removeDirectories'
			destination: PermissionUpdateDestination
			directories: string[]
	  }

export type WorkingDirectorySource = PermissionRuleSource

export type AdditionalWorkingDirectory = {
	path: string
	source: WorkingDirectorySource
}

// ============================================================================
// Permission Decisions & Results
// ============================================================================

export type PermissionCommandMetadata = {
	name: string
	description?: string
	[key: string]: unknown
}

export type PermissionMetadata = {command: PermissionCommandMetadata} | undefined

export type PermissionAllowDecision<
	Input extends {[key: string]: unknown} = {[key: string]: unknown},
> = {
	behavior: 'allow'
	updatedInput?: Input
	userModified?: boolean
	decisionReason?: PermissionDecisionReason
	toolUseID?: string
	acceptFeedback?: string
	contentBlocks?: ContentBlockParam[]
}

export type PendingClassifierCheck = {
	command: string
	cwd: string
	descriptions: string[]
}

export type PermissionAskDecision<
	Input extends {[key: string]: unknown} = {[key: string]: unknown},
> = {
	behavior: 'ask'
	message: string
	updatedInput?: Input
	decisionReason?: PermissionDecisionReason
	suggestions?: PermissionUpdate[]
	blockedPath?: string
	metadata?: PermissionMetadata
	isBashSecurityCheckForMisparsing?: boolean
	pendingClassifierCheck?: PendingClassifierCheck
	contentBlocks?: ContentBlockParam[]
}

export type PermissionDenyDecision = {
	behavior: 'deny'
	message: string
	decisionReason: PermissionDecisionReason
	toolUseID?: string
}

export type PermissionDecision<
	Input extends {[key: string]: unknown} = {[key: string]: unknown},
> =
	| PermissionAllowDecision<Input>
	| PermissionAskDecision<Input>
	| PermissionDenyDecision

export type PermissionResult<
	Input extends {[key: string]: unknown} = {[key: string]: unknown},
> =
	| PermissionDecision<Input>
	| {
			behavior: 'passthrough'
			message: string
			decisionReason?: PermissionDecision<Input>['decisionReason']
			suggestions?: PermissionUpdate[]
			blockedPath?: string
			pendingClassifierCheck?: PendingClassifierCheck
	  }

export type PermissionDecisionReason =
	| {type: 'rule'; rule: PermissionRule}
	| {type: 'mode'; mode: PermissionMode}
	| {type: 'subcommandResults'; reasons: Map<string, PermissionResult>}
	| {
			type: 'permissionPromptTool'
			permissionPromptToolName: string
			toolResult: unknown
	  }
	| {type: 'hook'; hookName: string; hookSource?: string; reason?: string}
	| {type: 'asyncAgent'; reason: string}
	| {
			type: 'sandboxOverride'
			reason: 'excludedCommand' | 'dangerouslyDisableSandbox'
	  }
	| {type: 'classifier'; classifier: string; reason: string}
	| {type: 'workingDir'; reason: string}
	| {
			type: 'safetyCheck'
			reason: string
			classifierApprovable: boolean
	  }
	| {type: 'other'; reason: string}

// ============================================================================
// Classifier Types
// ============================================================================

export type ClassifierResult = {
	matches: boolean
	matchedDescription?: string
	confidence: 'high' | 'medium' | 'low'
	reason: string
}

export type ClassifierBehavior = 'deny' | 'ask' | 'allow'

export type ClassifierUsage = {
	inputTokens: number
	outputTokens: number
	cacheReadInputTokens: number
	cacheCreationInputTokens: number
}

export type YoloClassifierResult = {
	thinking?: string
	shouldBlock: boolean
	reason: string
	unavailable?: boolean
	transcriptTooLong?: boolean
	model: string
	usage?: ClassifierUsage
	durationMs?: number
	promptLengths?: {
		systemPrompt: number
		toolCalls: number
		userPrompts: number
	}
	errorDumpPath?: string
	stage?: 'fast' | 'thinking'
	stage1Usage?: ClassifierUsage
	stage1DurationMs?: number
	stage1RequestId?: string
	stage1MsgId?: string
	stage2Usage?: ClassifierUsage
	stage2DurationMs?: number
	stage2RequestId?: string
	stage2MsgId?: string
}

// ============================================================================
// Permission Explainer
// ============================================================================

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'

export type PermissionExplanation = {
	riskLevel: RiskLevel
	explanation: string
	reasoning: string
	risk: string
}

// ============================================================================
// Tool Permission Context
// ============================================================================

export type ToolPermissionRulesBySource = {
	[T in PermissionRuleSource]?: string[]
}

export type ToolPermissionContext = {
	readonly mode: PermissionMode
	readonly additionalWorkingDirectories: ReadonlyMap<string, AdditionalWorkingDirectory>
	readonly alwaysAllowRules: ToolPermissionRulesBySource
	readonly alwaysDenyRules: ToolPermissionRulesBySource
	readonly alwaysAskRules: ToolPermissionRulesBySource
	readonly isBypassPermissionsModeAvailable: boolean
	readonly strippedDangerousRules?: ToolPermissionRulesBySource
	readonly shouldAvoidPermissionPrompts?: boolean
	readonly awaitAutomatedChecksBeforeDialog?: boolean
	readonly prePlanMode?: PermissionMode
}

// ============================================================================
// CanUseToolFn — still references product Tool/ToolUseContext (K-DEFAULT debt)
// Will be resolved when Tool types are inlined in stage 2 B-class split.
// ============================================================================

import type {Tool, ToolUseContext} from './tool.js'

export type CanUseToolFn<
	Input extends Record<string, unknown> = Record<string, unknown>,
> = (
	tool: Tool,
	input: Input,
	toolUseContext: ToolUseContext,
	assistantMessage: AssistantMessage,
	toolUseID: string,
	forceDecision?: PermissionDecision<Input>,
) => Promise<PermissionDecision<Input>>
