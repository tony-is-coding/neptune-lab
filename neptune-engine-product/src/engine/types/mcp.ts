/**
 * engine/types/mcp.ts
 *
 * MCP 类型屏障文件
 *
 * 重新导出 src/services/mcp/types.ts 的核心类型，避免 engine/ 向外穿透到 src/services/。
 *
 * @module
 */

// 重新导出 MCP 相关类型
export type {
	MCPServerConnection,
	ServerResource,
	ConnectedMCPServer,
	FailedMCPServer,
	NeedsAuthMCPServer,
	PendingMCPServer,
	DisabledMCPServer,
} from '../../services/mcp/types.js'
