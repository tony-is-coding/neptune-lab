import type { Command } from 'claude-code-best/commands.js'
import { hasAnthropicApiKeyAuth } from 'claude-code-best/utils/auth.js'
import { isEnvTruthy } from 'claude-code-best/utils/envUtils.js'

export default () =>
  ({
    type: 'local-jsx',
    name: 'login',
    description: hasAnthropicApiKeyAuth()
      ? 'Switch Anthropic accounts'
      : 'Sign in with your Anthropic account',
    isEnabled: () => !isEnvTruthy(process.env.DISABLE_LOGIN_COMMAND),
    load: () => import('./login.js'),
  }) satisfies Command
