import { useEffect, useRef } from 'react'
import { getIsRemoteMode } from 'claude-code-best/engine/session/SessionContext.js'
import {
  type Notification,
  type TextNotification,
  useNotifications,
} from '../../context/notifications.js'
import { useAppState } from 'claude-code-best/state/AppState.js'
import { isInProcessTeammateTask } from 'claude-code-best/tasks/InProcessTeammateTask/types.js'

function parseCount(notif: Notification): number {
  if (!('text' in notif)) {
    return 1
  }
  const match = notif.text.match(/^(\d+)/)
  return match?.[1] ? parseInt(match[1], 10) : 1
}

function foldSpawn(acc: TextNotification, _incoming: TextNotification): TextNotification {
  return makeSpawnNotif(parseCount(acc) + 1)
}

function makeSpawnNotif(count: number): TextNotification {
  return {
    key: 'teammate-spawn',
    text: count === 1 ? '1 agent spawned' : `${count} agents spawned`,
    priority: 'low',
    timeoutMs: 5000,
    fold: foldSpawn as any, // 类型断言，因为 fold 的类型签名与实际使用不匹配
  }
}

function foldShutdown(
  acc: TextNotification,
  _incoming: TextNotification,
): TextNotification {
  return makeShutdownNotif(parseCount(acc) + 1)
}

function makeShutdownNotif(count: number): TextNotification {
  return {
    key: 'teammate-shutdown',
    text: count === 1 ? '1 agent shut down' : `${count} agents shut down`,
    priority: 'low',
    timeoutMs: 5000,
    fold: foldShutdown as any, // 类型断言，因为 fold 的类型签名与实际使用不匹配
  }
}

/**
 * Fires batched notifications when in-process teammates spawn or shut down.
 * Uses fold() to combine repeated events into a single notification
 * like "3 agents spawned" or "2 agents shut down".
 */
export function useTeammateLifecycleNotification(): void {
  const tasks = useAppState(s => s.tasks)
  const { addNotification } = useNotifications()
  const seenRunningRef = useRef<Set<string>>(new Set())
  const seenCompletedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (getIsRemoteMode()) return
    for (const [id, task] of Object.entries(tasks)) {
      if (!isInProcessTeammateTask(task)) {
        continue
      }

      if (task.status === 'running' && !seenRunningRef.current.has(id)) {
        seenRunningRef.current.add(id)
        addNotification(makeSpawnNotif(1))
      }

      if (task.status === 'completed' && !seenCompletedRef.current.has(id)) {
        seenCompletedRef.current.add(id)
        addNotification(makeShutdownNotif(1))
      }
    }
  }, [tasks, addNotification])
}
