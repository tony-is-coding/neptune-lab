/** @cli-only */
import React, {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
} from 'react'
import type { Command } from '../../commands.js'
import type { Tool } from '../../Tool.js'
import type {
  MCPServerConnection,
  ScopedMcpServerConfig,
  ServerResource,
} from './types.js'
import { useManageMCPConnections } from './useManageMCPConnections.js'

/**
 * 获取通知发送器
 *
 * 这个函数可以在 CLI 层被重写以提供实际的通知功能。
 * 在框架核心中，它返回 undefined，表示不发送通知。
 */
export function getNotificationSender():
  | ((notification: import('../../types/notification.js').CoreNotification) => void)
  | undefined {
  // 框架核心默认不发送通知
  // CLI 层可以通过模块替换来提供实际实现
  return undefined
}

interface MCPConnectionContextValue {
  reconnectMcpServer: (serverName: string) => Promise<{
    client: MCPServerConnection
    tools: Tool[]
    commands: Command[]
    resources?: ServerResource[]
  }>
  toggleMcpServer: (serverName: string) => Promise<void>
}

const MCPConnectionContext = createContext<MCPConnectionContextValue | null>(
  null,
)

export function useMcpReconnect() {
  const context = useContext(MCPConnectionContext)
  if (!context) {
    throw new Error('useMcpReconnect must be used within MCPConnectionManager')
  }
  return context.reconnectMcpServer
}

export function useMcpToggleEnabled() {
  const context = useContext(MCPConnectionContext)
  if (!context) {
    throw new Error(
      'useMcpToggleEnabled must be used within MCPConnectionManager',
    )
  }
  return context.toggleMcpServer
}

interface MCPConnectionManagerProps {
  children: ReactNode
  dynamicMcpConfig: Record<string, ScopedMcpServerConfig> | undefined
  isStrictMcpConfig: boolean
}

// TODO (ollie): We may be able to get rid of this context by putting these function on app state
export function MCPConnectionManager({
  children,
  dynamicMcpConfig,
  isStrictMcpConfig,
}: MCPConnectionManagerProps): React.ReactNode {
  const addNotification = getNotificationSender()
  const { reconnectMcpServer, toggleMcpServer } = useManageMCPConnections(
    dynamicMcpConfig,
    isStrictMcpConfig,
    addNotification,
  )
  const value = useMemo(
    () => ({ reconnectMcpServer, toggleMcpServer }),
    [reconnectMcpServer, toggleMcpServer],
  )

  return (
    <MCPConnectionContext.Provider value={value}>
      {children}
    </MCPConnectionContext.Provider>
  )
}
