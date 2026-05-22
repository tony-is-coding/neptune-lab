export type McpServerResource = {
	uri: string
	name: string
	mimeType?: string
	description?: string
	server: string
}

export type McpResourceContent =
	| {
		uri: string
		mimeType?: string
		text: string
	}
	| {
		uri: string
		mimeType?: string
		blobBase64: string
	}
	| {
		uri: string
		mimeType?: string
	}

export type PersistedMcpResourceBlob =
	| {filepath: string; size: number}
	| {error: string}

export type McpResourceRuntime = {
	listResources(input: {server?: string}): Promise<McpServerResource[]>
	readResource(input: {
		server: string
		uri: string
	}): Promise<{contents: McpResourceContent[]}>
	persistBlob(input: {
		bytes: Uint8Array
		mimeType?: string
		persistId: string
	}): Promise<PersistedMcpResourceBlob>
	getBinaryBlobSavedMessage(
		filepath: string,
		mimeType: string | undefined,
		size: number,
		sourceDescription: string,
	): string
}

export function getMcpResourceRuntime(options: {
	[key: string]: unknown
}): McpResourceRuntime {
	const runtime = options.mcpResourceRuntime
	if (!isMcpResourceRuntime(runtime)) {
		throw new Error('MCP resource runtime is not configured')
	}
	return runtime
}

function isMcpResourceRuntime(value: unknown): value is McpResourceRuntime {
	if (typeof value !== 'object' || value === null) return false
	const candidate = value as Partial<Record<keyof McpResourceRuntime, unknown>>
	return (
		typeof candidate.listResources === 'function' &&
		typeof candidate.readResource === 'function' &&
		typeof candidate.persistBlob === 'function' &&
		typeof candidate.getBinaryBlobSavedMessage === 'function'
	)
}
