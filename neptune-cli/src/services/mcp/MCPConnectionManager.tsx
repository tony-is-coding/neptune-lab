/**
 * CLI 层的 MCPConnectionManager 实现
 *
 * 覆盖框架核心的 MCPConnectionManager，添加通知功能。
 */

import React, {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
} from 'react'
import type { Command } from 'src/commands.js'
import type { Tool } from 'src/Tool.js'
import type {
  MCPServerConnection,
  ScopedMcpServerConfig,
  ServerResource,
} from 'src/services/mcp/types.js'
import { useManageMCPConnections } from 'src/services/mcp/useManageMCPConnections.js'
import { useNotifications } from '../context/notifications.js'

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
  const { addNotification } = useNotifications()
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
