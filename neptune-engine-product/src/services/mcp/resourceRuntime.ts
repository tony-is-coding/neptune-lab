import {
	ReadResourceResultSchema,
	type ReadResourceResult,
} from '@modelcontextprotocol/sdk/types.js'
import type {McpResourceRuntime} from '@neptune/builtin-tools/tools/MCPResourceRuntime.js'
import {
	ensureConnectedClient,
	fetchResourcesForClient,
} from './client.js'
import type {MCPServerConnection} from './types.js'
import {errorMessage} from '../../utils/errors.js'
import {
	getBinaryBlobSavedMessage,
	persistBinaryContent,
} from '../../utils/mcpOutputStorage.js'
import {logMCPError} from '../../utils/log.js'

export function createMcpResourceRuntime(
	mcpClients: MCPServerConnection[],
): McpResourceRuntime {
	return {
		async listResources({server}) {
			const clientsToProcess = server
				? mcpClients.filter(client => client.name === server)
				: mcpClients

			if (server && clientsToProcess.length === 0) {
				throw new Error(
					`Server "${server}" not found. Available servers: ${mcpClients.map(c => c.name).join(', ')}`,
				)
			}

			const results = await Promise.all(
				clientsToProcess.map(async client => {
					if (client.type !== 'connected') return []
					try {
						const fresh = await ensureConnectedClient(client)
						return await fetchResourcesForClient(fresh)
					} catch (error) {
						logMCPError(client.name, errorMessage(error))
						return []
					}
				}),
			)

			return results.flat()
		},
		async readResource({server, uri}) {
			const client = mcpClients.find(client => client.name === server)

			if (!client) {
				throw new Error(
					`Server "${server}" not found. Available servers: ${mcpClients.map(c => c.name).join(', ')}`,
				)
			}

			if (client.type !== 'connected') {
				throw new Error(`Server "${server}" is not connected`)
			}

			if (!client.capabilities?.resources) {
				throw new Error(`Server "${server}" does not support resources`)
			}

			const connectedClient = await ensureConnectedClient(client)
			const result = (await connectedClient.client.request(
				{
					method: 'resources/read',
					params: {uri},
				},
				ReadResourceResultSchema,
			)) as ReadResourceResult

			return {
				contents: result.contents.map(c => {
					if ('text' in c) {
						return {uri: c.uri, mimeType: c.mimeType, text: c.text}
					}
					if ('blob' in c && typeof c.blob === 'string') {
						return {uri: c.uri, mimeType: c.mimeType, blobBase64: c.blob}
					}
					return {uri: c.uri, mimeType: c.mimeType}
				}),
			}
		},
		async persistBlob({bytes, mimeType, persistId}) {
			return persistBinaryContent(Buffer.from(bytes), mimeType, persistId)
		},
		getBinaryBlobSavedMessage,
	}
}
