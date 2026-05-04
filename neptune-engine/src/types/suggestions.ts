/**
 * Suggestion item for prompt overlay - shared between framework and CLI
 */
export type SuggestionItem = {
  id: string
  displayText: string
  tag?: string
  description?: string
  metadata?: unknown
  color?: string
}
