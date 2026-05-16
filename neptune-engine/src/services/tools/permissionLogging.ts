/**
 * Code editing tool identification for permission logging.
 * Extracted from CLI (hooks/toolPermission/permissionLogging) to eliminate framework→CLI dependency.
 */

const CODE_EDITING_TOOLS = ['Edit', 'Write', 'NotebookEdit']

export function isCodeEditingTool(toolName: string): boolean {
	return CODE_EDITING_TOOLS.includes(toolName)
}

/**
 * Builds attributes for code editing tools, enriching with language info.
 */
export async function buildCodeEditToolAttributes(
	tool: {
		getPath?: (input: unknown) => string | undefined;
		inputSchema: { safeParse: (input: unknown) => { success: boolean; data?: unknown } }
	},
	input: unknown,
	decision: 'accept' | 'reject',
	source: string,
): Promise<Record<string, string>> {
	let language: string | undefined
	if (tool.getPath && input) {
		const parseResult = tool.inputSchema.safeParse(input)
		if (parseResult.success && parseResult.data) {
			const filePath = tool.getPath(parseResult.data)
			if (filePath) {
				try {
					const {getLanguageName} = await import('../../utils/cliHighlight.js')
					language = await getLanguageName(filePath)
				} catch {
					// Ignore if cliHighlight not available
				}
			}
		}
	}

	return {
		decision,
		source,
		...(language && {language}),
	}
}
