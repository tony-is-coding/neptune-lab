import { getIsNonInteractiveSession } from 'claude-code-best/bootstrap/state.js'
import type { Command } from 'claude-code-best/commands.js'

const command: Command = {
  name: 'chrome',
  description: 'Claude in Chrome (Beta) settings',
  availability: [],
  isEnabled: () => !getIsNonInteractiveSession(),
  type: 'local-jsx',
  load: () => import('./chrome.js'),
}

export default command
