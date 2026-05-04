import type * as React from 'react'
import { useCallback, useEffect, useMemo } from 'react'
import { useAppStateStore, useSetAppState } from 'claude-code-best/state/AppState.js'
import type { Theme } from 'claude-code-best/utils/theme.js'
// 从核心类型文件导入纯数据版本
import type {
  BaseNotification,
  CoreNotification,
  NotificationPriority,
} from 'claude-code-best/types/notification.js'

// 重新导出核心类型供 CLI 使用
export type { NotificationPriority } from 'claude-code-best/types/notification.js'

// CLI 特定的 TextNotification，继承核心的 CoreNotification
export type TextNotification = CoreNotification

// CLI 专用的 JSXNotification（含 React 依赖）
export type JSXNotification = BaseNotification & {
  jsx: React.ReactNode
}

// CLI 使用的完整 Notification 类型（Text + JSX）
export type Notification = TextNotification | JSXNotification

type AddNotificationFn = (content: Notification | Record<string, unknown>) => void
type RemoveNotificationFn = (key: string) => void

const DEFAULT_TIMEOUT_MS = 8000

// Track current timeout to clear it when immediate notifications arrive
let currentTimeoutId: NodeJS.Timeout | null = null

export function useNotifications(): {
  addNotification: AddNotificationFn
  removeNotification: RemoveNotificationFn
} {
  const store = useAppStateStore()
  const setAppState = useSetAppState()

  // Process queue when current notification finishes or queue changes
  const processQueue = useCallback(() => {
    setAppState(prev => {
      const next = getNext(prev.notifications.queue)
      if (prev.notifications.current !== null || !next) {
        return prev
      }

      currentTimeoutId = setTimeout(
        (setAppState, nextKey, processQueue) => {
          currentTimeoutId = null
          setAppState(prev => {
            // Compare by key instead of reference to handle re-created notifications
            if (prev.notifications.current?.key !== nextKey) {
              return prev
            }
            return {
              ...prev,
              notifications: {
                queue: prev.notifications.queue,
                current: null,
              },
            }
          })
          processQueue()
        },
        next.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        setAppState,
        next.key,
        processQueue,
      )

      return {
        ...prev,
        notifications: {
          queue: prev.notifications.queue.filter(_ => _ !== next),
          current: next,
        },
      }
    })
  }, [setAppState])

  const addNotification = useCallback<AddNotificationFn>(
    (content: Notification | Record<string, unknown>) => {
      // 类型守卫：检查是否为有效的 Notification
      if (!content || typeof content !== 'object') {
        return
      }
      const notif = content as Notification
      // Handle immediate priority notifications
      if (notif.priority === 'immediate') {
        // Clear any existing timeout since we're showing a new immediate notification
        if (currentTimeoutId) {
          clearTimeout(currentTimeoutId)
          currentTimeoutId = null
        }

        // Set up timeout for the immediate notification
        currentTimeoutId = setTimeout(
          (setAppState, notif, processQueue) => {
            currentTimeoutId = null
            setAppState(prev => {
              // Compare by key instead of reference to handle re-created notifications
              if (prev.notifications.current?.key !== notif.key) {
                return prev
              }
              return {
                ...prev,
                notifications: {
                  queue: prev.notifications.queue.filter(
                    _ => !notif.invalidates?.includes(_.key),
                  ),
                  current: null,
                },
              }
            })
            processQueue()
          },
          notif.timeoutMs ?? DEFAULT_TIMEOUT_MS,
          setAppState,
          notif,
          processQueue,
        )

        // Show the immediate notification right away
        setAppState(prev => ({
          ...prev,
          notifications: {
            current: notif,
            queue:
              // Only re-queue the current notification if it's not immediate
              [
                ...(prev.notifications.current
                  ? [prev.notifications.current]
                  : []),
                ...prev.notifications.queue,
              ].filter(
                _ =>
                  _.priority !== 'immediate' &&
                  !notif.invalidates?.includes(_.key),
              ),
          },
        }))
        return // IMPORTANT: Exit addNotification for immediate notifications
      }

      // Handle non-immediate notifications
      setAppState(prev => {
        // Check if we can fold into an existing notification with the same key
        if (notif.fold) {
          // Fold into current notification if keys match
          if (prev.notifications.current?.key === notif.key) {
            const folded = notif.fold(
              prev.notifications.current as any,
              notif as any,
            )
            // Reset timeout for the folded notification
            if (currentTimeoutId) {
              clearTimeout(currentTimeoutId)
              currentTimeoutId = null
            }
            currentTimeoutId = setTimeout(
              (setAppState, foldedKey, processQueue) => {
                currentTimeoutId = null
                setAppState(p => {
                  if (p.notifications.current?.key !== foldedKey) {
                    return p
                  }
                  return {
                    ...p,
                    notifications: {
                      queue: p.notifications.queue,
                      current: null,
                    },
                  }
                })
                processQueue()
              },
              folded.timeoutMs ?? DEFAULT_TIMEOUT_MS,
              setAppState,
              folded.key,
              processQueue,
            )

            return {
              ...prev,
              notifications: {
                current: folded,
                queue: prev.notifications.queue,
              },
            }
          }

          // Fold into queued notification if keys match
          const queueIdx = prev.notifications.queue.findIndex(
            _ => _.key === notif.key,
          )
          if (queueIdx !== -1) {
            const folded = notif.fold(
              prev.notifications.queue[queueIdx]! as any,
              notif as any,
            )
            const newQueue = [...prev.notifications.queue]
            newQueue[queueIdx] = folded
            return {
              ...prev,
              notifications: {
                current: prev.notifications.current,
                queue: newQueue,
              },
            }
          }
        }

        // Only add to queue if not already present (prevent duplicates)
        const queuedKeys = new Set(prev.notifications.queue.map(_ => _.key))
        const shouldAdd =
          !queuedKeys.has(notif.key) &&
          prev.notifications.current?.key !== notif.key

        if (!shouldAdd) return prev

        const invalidatesCurrent =
          prev.notifications.current !== null &&
          notif.invalidates?.includes(prev.notifications.current.key)

        if (invalidatesCurrent && currentTimeoutId) {
          clearTimeout(currentTimeoutId)
          currentTimeoutId = null
        }

        return {
          ...prev,
          notifications: {
            current: invalidatesCurrent ? null : prev.notifications.current,
            queue: [
              ...prev.notifications.queue.filter(
                _ =>
                  _.priority !== 'immediate' &&
                  !notif.invalidates?.includes(_.key),
              ),
              notif,
            ],
          },
        }
      })

      // Process queue after adding the notification
      processQueue()
    },
    [setAppState, processQueue],
  )

  const removeNotification = useCallback<RemoveNotificationFn>(
    (key: string) => {
      setAppState(prev => {
        const isCurrent = prev.notifications.current?.key === key
        const inQueue = prev.notifications.queue.some(n => n.key === key)

        if (!isCurrent && !inQueue) {
          return prev
        }

        if (isCurrent && currentTimeoutId) {
          clearTimeout(currentTimeoutId)
          currentTimeoutId = null
        }

        return {
          ...prev,
          notifications: {
            current: isCurrent ? null : prev.notifications.current,
            queue: prev.notifications.queue.filter(n => n.key !== key),
          },
        }
      })

      processQueue()
    },
    [setAppState, processQueue],
  )

  // Process queue on mount if there are notifications in the initial state.
  // Imperative read (not useAppState) — a subscription in a mount-only
  // effect would be vestigial and make every caller re-render on queue changes.
  // eslint-disable-next-line react-hooks/exhaustive-dependencies
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only effect, store is a stable context ref
  useEffect(() => {
    if (store.getState().notifications.queue.length > 0) {
      processQueue()
    }
  }, [])

  return { addNotification, removeNotification }
}

const PRIORITIES: Record<NotificationPriority, number> = {
  immediate: 0,
  high: 1,
  medium: 2,
  low: 3,
}
export function getNext(queue: Notification[]): Notification | undefined {
  if (queue.length === 0) return undefined
  return queue.reduce((min, n) =>
    PRIORITIES[n.priority] < PRIORITIES[min.priority] ? n : min,
  )
}

// 重新导出核心类型和工具
export type { NotificationEmitter } from 'claude-code-best/types/notification.js'
export { createNotificationEmitter, getGlobalNotificationEmitter } from 'claude-code-best/utils/notificationManager.js'

/**
 * 创建 NotificationEmitter 适配器
 *
 * 将 React 的 useNotifications hook 转换为框架核心的 NotificationEmitter 接口。
 * 用于解耦 React 依赖，使非 React 组件也能发送通知。
 *
 * @example
 * ```tsx
 * const { addNotification } = useNotifications()
 * const emitter = useNotificationEmitter(addNotification)
 * ```
 */
export function useNotificationEmitter(
  addNotification: (notification: Notification | Record<string, unknown>) => void,
): import('src/types/notification.js').NotificationEmitter {
  return useMemo(
    () => ({
      emit: (notification: import('src/types/notification.js').CoreNotification) => {
        addNotification(notification)
      },
    }),
    [addNotification],
  )
}

/**
 * 从 useNotifications hook 创建 NotificationEmitter 的完整 hook
 *
 * 这是一个便捷函数，结合了 useNotifications 和 useNotificationEmitter。
 * 用于需要 NotificationEmitter 接口的 React 组件中。
 *
 * @example
 * ```tsx
 * const notificationEmitter = useNotificationEmitterFromNotifications()
 * ```
 */
export function useNotificationEmitterFromNotifications(): import('src/types/notification.js').NotificationEmitter {
  const { addNotification } = useNotifications()
  return useNotificationEmitter(addNotification)
}
