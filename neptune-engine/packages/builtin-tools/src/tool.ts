import type {
	ToolResultBlockParam,
	ToolUseBlockParam,
} from '@anthropic-ai/sdk/resources/index.mjs'
import type {z} from 'zod/v4'
import type {
	PermissionResult,
	Tool,
	ToolCallProgress,
	ToolInputJSONSchema,
	ToolProgress,
	ToolProgressData,
	ToolResult,
	Tools,
	ValidationResult,
} from '@neptune/engine-tools'

export type {ToolResultBlockParam}
export type {
	PermissionResult,
	Tool,
	ToolCallProgress,
	ToolInputJSONSchema,
	ToolProgress,
	ToolProgressData,
	ToolResult,
	Tools,
	ValidationResult,
}

export type ToolUseContext = {
	[key: string]: unknown
	abortController?: AbortController
	getAppState?: () => unknown
	options?: {
		tools?: readonly Tool[]
		[key: string]: unknown
	}
}

export type ToolPermissionContext = {
	mode?: string
	additionalWorkingDirectories?: Map<string, unknown>
	alwaysAllowRules?: Record<string, unknown>
	alwaysDenyRules?: Record<string, unknown>
	alwaysAskRules?: Record<string, unknown>
	isBypassPermissionsModeAvailable?: boolean
	[key: string]: unknown
}

type AnyObject = z.ZodType<{[key: string]: unknown}>

type HostTool<Input extends AnyObject = AnyObject, Output = unknown, P = unknown> =
	Tool<Input, Output, P> & {
		strict?: boolean
		renderToolUseMessage?(
			input: Partial<z.infer<Input>>,
			options?: unknown,
		): unknown
		renderToolResultMessage?(
			content: Output,
			progressMessagesForMessage: unknown[],
			options: unknown,
		): unknown
		renderToolUseProgressMessage?(
			progressMessagesForMessage: unknown[],
			options: unknown,
		): unknown
		renderToolUseQueuedMessage?(): unknown
		renderToolUseRejectedMessage?(input: z.infer<Input>, options: unknown): unknown
		renderToolUseErrorMessage?(
			result: ToolResultBlockParam['content'],
			options: unknown,
		): unknown
		renderGroupedToolUse?(
			toolUses: Array<{
				param: ToolUseBlockParam
				isResolved: boolean
				isError: boolean
				isInProgress: boolean
				progressMessages: unknown[]
				result?: {
					param: ToolResultBlockParam
					output: unknown
				}
			}>,
			options: unknown,
		): unknown | null
		userFacingNameBackgroundColor?(
			input: Partial<z.infer<Input>> | undefined,
		): string | undefined
		extractSearchText?(out: Output): string
	}

type DefaultableToolKeys =
	| 'isEnabled'
	| 'isConcurrencySafe'
	| 'isReadOnly'
	| 'isDestructive'
	| 'checkPermissions'
	| 'toAutoClassifierInput'
	| 'userFacingName'

export type ToolDef<
	Input extends AnyObject = AnyObject,
	Output = unknown,
	P extends ToolProgressData = ToolProgressData,
> = Omit<HostTool<Input, Output, P>, DefaultableToolKeys> &
	Partial<Pick<HostTool<Input, Output, P>, DefaultableToolKeys>>

const TOOL_DEFAULTS = {
	isEnabled: () => true,
	isConcurrencySafe: (_input?: unknown) => false,
	isReadOnly: (_input?: unknown) => false,
	isDestructive: (_input?: unknown) => false,
	checkPermissions: (
		input: {[key: string]: unknown},
		_ctx?: ToolUseContext,
	): Promise<PermissionResult> =>
		Promise.resolve({behavior: 'allow', updatedInput: input}),
	toAutoClassifierInput: (_input?: unknown) => '',
	userFacingName: () => '',
}

type ToolDefaults = typeof TOOL_DEFAULTS
type BuiltTool<D> = Omit<D, DefaultableToolKeys> & {
	[K in DefaultableToolKeys]-?: K extends keyof D
		? undefined extends D[K]
			? ToolDefaults[K]
			: D[K]
		: ToolDefaults[K]
}
type AnyToolDef = ToolDef<any, any, any>

export function buildTool<D extends AnyToolDef>(def: D): BuiltTool<D> {
	return {
		...TOOL_DEFAULTS,
		userFacingName: () => def.name,
		...def,
	} as BuiltTool<D>
}

export function toolMatchesName(
	tool: {name: string; aliases?: readonly string[]},
	name: string,
): boolean {
	return tool.name === name || (tool.aliases?.includes(name) ?? false)
}

export function findToolByName(
	tools: readonly {name: string; aliases?: readonly string[]}[],
	name: string,
): Tool | undefined {
	return tools.find(tool => toolMatchesName(tool, name)) as Tool | undefined
}
