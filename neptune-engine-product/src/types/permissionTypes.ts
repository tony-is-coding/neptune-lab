/**
 * Tool use confirmation type - shared between framework and CLI
 * Contains properties accessed by framework core code
 */
import type {PermissionDecision} from './permissions.js'

export type ToolUseConfirm = {
	toolUseID: string
	description: string
	tool: { name: string; [key: string]: unknown }
	input: Record<string, unknown>
	permissionResult: PermissionDecision
	permissionPromptStartTimeMs: number
	recheckPermission: () => Promise<void>
	[key: string]: unknown
}
