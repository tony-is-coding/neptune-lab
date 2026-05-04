/**
 * Poor mode state — when active, skips extract_memories and prompt_suggestion
 * to reduce token consumption.
 *
 * Persisted to settings.json so it survives session restarts.
 *
 * This module now re-exports the framework's poorModeState to maintain
 * backward compatibility while eliminating the duplicated state management.
 */

export {
  isPoorModeActive,
  setPoorModeActive as setPoorMode,
} from 'claude-code-best/utils/poorModeState.js'
