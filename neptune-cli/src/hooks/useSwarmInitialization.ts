/**
 * Swarm Initialization Hook
 *
 * Initializes swarm features: teammate hooks and context.
 * Handles both fresh spawns and resumed teammate sessions.
 *
 * This hook is conditionally loaded to allow dead code elimination when swarms are disabled.
 */

import { useEffect } from 'react'
import { getSessionId } from 'claude-code-best/engine/session/SessionContext.js'
import type { AppState } from 'claude-code-best/state/AppState.js'
import type { Message } from 'claude-code-best/types/message.js'
import { isAgentSwarmsEnabled } from 'claude-code-best/utils/agentSwarmsEnabled.js'
import { initializeTeammateContextFromSession } from 'claude-code-best/utils/swarm/reconnection.js'
import { readTeamFile } from 'claude-code-best/utils/swarm/teamHelpers.js'
import { initializeTeammateHooks } from 'claude-code-best/utils/swarm/teammateInit.js'
import { getDynamicTeamContext } from 'claude-code-best/utils/teammate.js'

type SetAppState = (f: (prevState: AppState) => AppState) => void

/**
 * Hook that initializes swarm features when ENABLE_AGENT_SWARMS is true.
 *
 * Handles both:
 * - Resumed teammate sessions (from --resume or /resume) where teamName/agentName
 *   are stored in transcript messages
 * - Fresh spawns where context is read from environment variables
 */
export function useSwarmInitialization(
  setAppState: SetAppState,
  initialMessages: Message[] | undefined,
  { enabled = true }: { enabled?: boolean } = {},
): void {
  useEffect(() => {
    if (!enabled) return
    if (isAgentSwarmsEnabled()) {
      // Check if this is a resumed agent session (from --resume or /resume)
      // Resumed sessions have teamName/agentName stored in transcript messages
      const firstMessage = initialMessages?.[0]
      const teamName =
        firstMessage && 'teamName' in firstMessage
          ? (firstMessage.teamName as string | undefined)
          : undefined
      const agentName =
        firstMessage && 'agentName' in firstMessage
          ? (firstMessage.agentName as string | undefined)
          : undefined

      if (teamName && agentName) {
        // Resumed agent session - set up team context from stored info
        initializeTeammateContextFromSession(setAppState, teamName, agentName)

        // Get agentId from team file for hook initialization
        const teamFile = readTeamFile(teamName)
        const member = teamFile?.members.find(
          (m: { name: string }) => m.name === agentName,
        )
        if (member) {
          // V2 fix: SessionId type narrowing
          const sessionId = getSessionId()
          if (sessionId) {
            initializeTeammateHooks(setAppState, sessionId, {
              teamName,
              agentId: member.agentId,
              agentName,
            })
          }
        }
      } else {
        // Fresh spawn or standalone session
        // teamContext is already computed in main.tsx via computeInitialTeamContext()
        // and included in initialState, so we only need to initialize hooks here
        const context = getDynamicTeamContext?.()
        if (context?.teamName && context?.agentId && context?.agentName) {
          // V2 fix: SessionId type narrowing
          const sessionId = getSessionId()
          if (sessionId) {
            initializeTeammateHooks(setAppState, sessionId, {
              teamName: context.teamName,
              agentId: context.agentId,
              agentName: context.agentName,
            })
          }
        }
      }
    }
  }, [setAppState, initialMessages, enabled])
}
