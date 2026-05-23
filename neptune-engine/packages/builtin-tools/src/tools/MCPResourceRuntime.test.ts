import {describe, expect, test} from 'bun:test'
import {ListMcpResourcesTool} from './ListMcpResourcesTool/ListMcpResourcesTool.js'
import {ReadMcpResourceTool} from './ReadMcpResourceTool/ReadMcpResourceTool.js'
import type {McpResourceRuntime} from './MCPResourceRuntime.js'

function makeRuntime(): McpResourceRuntime {
	return {
		async listResources(client) {
			return [
				{
					uri: 'file:///tmp/a.txt',
					name: 'a.txt',
					server: client.server ?? 'filesystem',
					mimeType: 'text/plain',
				},
			]
		},
		async readResource({uri}) {
			return {
				contents: [
					{uri, mimeType: 'text/plain', text: 'hello'},
					{
						uri: 'file:///tmp/blob.bin',
						mimeType: 'application/octet-stream',
						blobBase64: Buffer.from('binary').toString('base64'),
					},
				],
			}
		},
		async persistBlob({bytes, mimeType, persistId}) {
			return {
				filepath: `/tmp/${persistId}.${mimeType === 'text/plain' ? 'txt' : 'bin'}`,
				size: bytes.length,
			}
		},
		getBinaryBlobSavedMessage(filepath, mimeType, size, sourceDescription) {
			return `${sourceDescription}Binary content (${mimeType}, ${size}) saved to ${filepath}`
		},
	}
}

describe('MCP resource tools runtime seam', () => {
	test('lists resources through injected runtime', async () => {
		const result = await ListMcpResourcesTool.call(
			{},
			{
				options: {
					mcpResourceRuntime: makeRuntime(),
				},
			},
		)

		expect(result.data).toEqual([
			{
				uri: 'file:///tmp/a.txt',
				name: 'a.txt',
				server: 'filesystem',
				mimeType: 'text/plain',
			},
		])
	})

	test('reads resources and persists blobs through injected runtime', async () => {
		const result = await ReadMcpResourceTool.call(
			{server: 'filesystem', uri: 'file:///tmp/a.txt'},
			{
				options: {
					mcpResourceRuntime: makeRuntime(),
				},
			},
		)

		expect(result.data.contents).toEqual([
			{
				uri: 'file:///tmp/a.txt',
				mimeType: 'text/plain',
				text: 'hello',
			},
			{
				uri: 'file:///tmp/blob.bin',
				mimeType: 'application/octet-stream',
				blobSavedTo: expect.stringContaining('/tmp/mcp-resource-'),
				text: expect.stringContaining(
					'Binary content (application/octet-stream, 6) saved to /tmp/mcp-resource-',
				),
			},
		])
	})
})
