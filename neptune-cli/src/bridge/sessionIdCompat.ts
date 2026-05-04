/**
 * Session ID tag translation helpers for the CCR v2 compat layer.
 *
 * This module re-exports the framework implementation to maintain
 * backward compatibility with existing CLI code that imports from here.
 * The actual implementation lives in claude-code/src/utils/sessionIdCompat.ts.
 */

export {
  setCseShimGate,
  toCompatSessionId,
  toInfraSessionId,
} from 'claude-code-best/utils/sessionIdCompat.js'
