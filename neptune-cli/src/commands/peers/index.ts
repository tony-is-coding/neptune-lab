import type { Command } from 'claude-code-best/commands.js'

const peers = {
  type: 'local',
  name: 'peers',
  aliases: ['who'],
  description: 'List connected Claude Code peers',
  supportsNonInteractive: true,
  load: () => import('./peers.js'),
} satisfies Command

export default peers
