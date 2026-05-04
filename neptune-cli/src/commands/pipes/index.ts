import type { Command } from 'claude-code-best/commands.js'

const pipes = {
  type: 'local',
  name: 'pipes',
  description: 'Inspect pipe registry state and toggle the pipe selector',
  supportsNonInteractive: true,
  load: () => import('./pipes.js'),
} satisfies Command

export default pipes
