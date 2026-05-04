import { useEffect } from 'react'
import { formatTotalCost, saveCurrentSessionCosts } from 'claude-code-best/cost-tracker.js'
import { hasConsoleBillingAccess } from 'claude-code-best/utils/billing.js'
import type { FpsMetrics } from 'claude-code-best/utils/fpsTracker.js'

export function useCostSummary(
  getFpsMetrics?: () => FpsMetrics | undefined,
): void {
  useEffect(() => {
    const f = () => {
      if (hasConsoleBillingAccess()) {
        process.stdout.write('\n' + formatTotalCost() + '\n')
      }

      saveCurrentSessionCosts(getFpsMetrics?.())
    }
    process.on('exit', f)
    return () => {
      process.off('exit', f)
    }
  }, [])
}
