// CompanionSprite disabled — buddy feature removed from framework core
// All buddy-related imports from claude-code/src/buddy/ are no longer available

import React from 'react'

export const MIN_COLS_FOR_FULL_SPRITE = 100

export function companionReservedColumns(
  _terminalColumns: number,
  _speaking: boolean,
): number {
  return 0
}

export function CompanionSprite(): React.ReactNode {
  return null
}

export function CompanionFloatingBubble(): React.ReactNode {
  return null
}
