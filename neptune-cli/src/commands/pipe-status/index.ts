import type { Command } from 'claude-code-best/commands.js'

const pipeStatus = {
  type: 'local',
  name: 'pipe-status',
  description: 'Show current pipe connection status',
  supportsNonInteractive: true,
  load: () => import('./pipe-status.js'),
} satisfies Command

export default pipeStatus
