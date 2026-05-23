/**
 * engine/types/mcp.ts — MCP 纯类型内联定义（engine 自有，无 product 依赖）
 *
 * 只提取 engine 层需要的纯接口类型，不引入 zod schema 或运行时依赖。
 * MCPServerConnection 等完整类型因依赖 @modelcontextprotocol/sdk Client 对象，
 * 此处用结构等价的 opaque 形式定义。
 */

// ============================================================================
// MCP Server Config (opaque subset — engine only needs the name/type discriminant)
// ============================================================================

export type ServerCapabilities = {
	[key: string]: unknown
}

export type Resource = {
	uri: string
	name?: string
	description?: string
	mimeType?: string
	[key: string]: unknown
}

/** Engine 层只关心 name + scope，不关心完整 config 结构 */
export type ScopedMcpServerConfigBase = {
	name?: string
	scope?: string
	[key: string]: unknown
}

// ============================================================================
// MCP Server Connection States
// ============================================================================

export type ConnectedMCPServer = {
	/** MCP client object (opaque to engine) */
	client: {[key: string]: unknown}
	name: string
	type: 'connected'
	capabilities: ServerCapabilities
	serverInfo?: {
		name: string
		version: string
	}
	instructions?: string
	config: ScopedMcpServerConfigBase
	cleanup: () => Promise<void>
}

export type FailedMCPServer = {
	name: string
	type: 'failed'
	config: ScopedMcpServerConfigBase
	error?: string
}

export type NeedsAuthMCPServer = {
	name: string
	type: 'needs-auth'
	config: ScopedMcpServerConfigBase
}

export type PendingMCPServer = {
	name: string
	type: 'pending'
	config: ScopedMcpServerConfigBase
	reconnectAttempt?: number
	maxReconnectAttempts?: number
}

export type DisabledMCPServer = {
	name: string
	type: 'disabled'
	config: ScopedMcpServerConfigBase
}

export type MCPServerConnection =
	| ConnectedMCPServer
	| FailedMCPServer
	| NeedsAuthMCPServer
	| PendingMCPServer
	| DisabledMCPServer

/** MCP resource with server name annotation */
export type ServerResource = Resource & {server: string}
