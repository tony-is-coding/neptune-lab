/**
 * Swarm permission callback registry
 *
 * Pure logic for managing in-process teammate permission callbacks.
 * Extracted from CLI (useSwarmPermissionPoller) to eliminate framework→CLI dependency.
 * The React hook (useSwarmPermissionPoller) remains in CLI for UI polling.
 */

import { logForDebugging } from '../debug.js'
import { errorMessage } from '../errors.js'
import {
  type PermissionUpdate,
  permissionUpdateSchema,
} from '../permissions/PermissionUpdateSchema.js'

/**
 * Callback signature for handling permission responses
 */
export type PermissionResponseCallback = {
  requestId: string
  toolUseId: string
  onAllow: (
    updatedInput: Record<string, unknown> | undefined,
    permissionUpdates: PermissionUpdate[],
    feedback?: string,
  ) => void
  onReject: (feedback?: string) => void
}

/**
 * Callback signature for handling sandbox permission responses
 */
export type SandboxPermissionResponseCallback = {
  requestId: string
  onAllow: () => void
  onReject: (feedback?: string) => void
}

/**
 * Registry for pending permission request callbacks
 */
type PendingCallbackRegistry = Map<string, PermissionResponseCallback>
type PendingSandboxCallbackRegistry = Map<string, SandboxPermissionResponseCallback>

// Module-level registries
const pendingCallbacks: PendingCallbackRegistry = new Map()
const pendingSandboxCallbacks: PendingSandboxCallbackRegistry = new Map()

/**
 * Register a callback for a pending permission request
 */
export function registerPermissionCallback(
  callback: PermissionResponseCallback,
): void {
  pendingCallbacks.set(callback.requestId, callback)
  logForDebugging(
    `[SwarmPermissionPoller] Registered callback for request ${callback.requestId}`,
  )
}

/**
 * Unregister a callback
 */
export function unregisterPermissionCallback(requestId: string): void {
  pendingCallbacks.delete(requestId)
  logForDebugging(
    `[SwarmPermissionPoller] Unregistered callback for request ${requestId}`,
  )
}

/**
 * Check if a request has a registered callback
 */
export function hasPermissionCallback(requestId: string): boolean {
  return pendingCallbacks.has(requestId)
}

/**
 * Register a sandbox permission callback
 */
export function registerSandboxPermissionCallback(
  callback: SandboxPermissionResponseCallback,
): void {
  pendingSandboxCallbacks.set(callback.requestId, callback)
  logForDebugging(
    `[SwarmPermissionPoller] Registered sandbox callback for request ${callback.requestId}`,
  )
}

/**
 * Check if a sandbox request has a registered callback
 */
export function hasSandboxPermissionCallback(requestId: string): boolean {
  return pendingSandboxCallbacks.has(requestId)
}

/**
 * Clear all pending callbacks (both permission and sandbox).
 */
export function clearAllPendingCallbacks(): void {
  pendingCallbacks.clear()
  pendingSandboxCallbacks.clear()
}

/**
 * Process a permission response from a mailbox message.
 */
export function processMailboxPermissionResponse(params: {
  requestId: string
  decision: string
  updatedInput?: Record<string, unknown> | undefined
  permissionUpdates?: unknown[]
  feedback?: string
}): boolean {
  const { requestId, decision, updatedInput, permissionUpdates, feedback } =
    params

  const callback = pendingCallbacks.get(requestId)
  if (!callback) {
    logForDebugging(
      `[SwarmPermissionPoller] No callback registered for request ${requestId}`,
    )
    return false
  }

  const parsedUpdates: PermissionUpdate[] = []
  if (permissionUpdates) {
    for (const raw of permissionUpdates) {
      const parsed = permissionUpdateSchema().safeParse(raw)
      if (parsed.success) {
        parsedUpdates.push(parsed.data as PermissionUpdate)
      }
      if (parsed.success) {
        parsedUpdates.push(parsed.data as PermissionUpdate)
      }
    }
  }

  if (decision === 'allow') {
    logForDebugging(
      `[SwarmPermissionPoller] Processing allow for request ${requestId}`,
    )
    callback.onAllow(updatedInput, parsedUpdates, feedback)
  } else {
    logForDebugging(
      `[SwarmPermissionPoller] Processing reject for request ${requestId}`,
    )
    callback.onReject(feedback)
  }

  pendingCallbacks.delete(requestId)
  return true
}

/**
 * Process a sandbox permission response.
 */
export function processSandboxPermissionResponse(params: {
  requestId: string
  decision: string
  feedback?: string
}): boolean {
  const { requestId, decision, feedback } = params
  const callback = pendingSandboxCallbacks.get(requestId)
  if (!callback) {
    logForDebugging(
      `[SwarmPermissionPoller] No sandbox callback for request ${requestId}`,
    )
    return false
  }

  if (decision === 'allow') {
    logForDebugging(
      `[SwarmPermissionPoller] Processing sandbox allow for ${requestId}`,
    )
    callback.onAllow()
  } else {
    logForDebugging(
      `[SwarmPermissionPoller] Processing sandbox reject for ${requestId}`,
    )
    callback.onReject(feedback)
  }

  pendingSandboxCallbacks.delete(requestId)
  return true
}
