// buddy command disabled — buddy feature removed from framework core
// This file is kept as a stub to prevent import errors

import type { Command } from 'claude-code-best/commands.js'

const buddy = {
  type: 'local-jsx',
  name: 'buddy',
  description: 'Hatch a coding companion · pet, off',
  argumentHint: '[pet|off]',
  immediate: true,
  get isHidden() {
    // Always hidden — feature removed from framework core
    return true
  },
  load: () => import('./buddy.js'),
} satisfies Command

export default buddy
