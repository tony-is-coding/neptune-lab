import { isInBundledMode } from 'claude-code-best/utils/bundledMode.js'
import { getCurrentInstallationType } from 'claude-code-best/utils/doctorDiagnostic.js'
import { isEnvTruthy } from 'claude-code-best/utils/envUtils.js'
import { useStartupNotification } from './useStartupNotification.js'

const NPM_DEPRECATION_MESSAGE =
  ''

export function useNpmDeprecationNotification(): void {
  useStartupNotification(async () => {
    if (
      isInBundledMode() ||
      isEnvTruthy(process.env.DISABLE_INSTALLATION_CHECKS)
    ) {
      return null
    }
    const installationType = await getCurrentInstallationType()
    if (installationType === 'development') return null
    return {
      timeoutMs: 15000,
      key: 'npm-deprecation-warning',
      text: NPM_DEPRECATION_MESSAGE,
      color: 'warning',
      priority: 'high',
    }
  })
}
