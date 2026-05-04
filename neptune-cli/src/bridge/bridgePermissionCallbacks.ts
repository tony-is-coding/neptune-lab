/**
 * Bridge permission types for Remote Control.
 *
 * This module re-exports the framework types to maintain backward
 * compatibility with existing CLI code that imports from here.
 * The actual type definitions live in claude-code/src/types/bridge.ts.
 */

export {
  isBridgePermissionResponse,
  type BridgePermissionCallbacks,
  type BridgePermissionResponse,
} from 'claude-code-best/types/bridge.js'
