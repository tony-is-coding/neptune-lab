import {getFeatureValue_CACHED_MAY_BE_STALE} from 'src/services/analytics/growthbook.js'
import {logEvent} from 'src/services/analytics/index.js'
import {isEnvTruthy} from 'src/utils/envUtils.js'
import {fetchSingleFileGitDiff} from 'src/utils/gitDiff.js'
import {expandPath} from 'src/utils/path.js'

const FILE_EDIT_TOOL_NAME = 'Edit'
const FILE_WRITE_TOOL_NAME = 'Write'

type FileToolOutput = {
	filePath?: unknown
	gitDiff?: unknown
	[key: string]: unknown
}

export async function enrichFileToolGitDiff({
	toolName,
	output,
}: {
	toolName: string
	output: unknown
}): Promise<unknown> {
	if (
		toolName !== FILE_EDIT_TOOL_NAME &&
		toolName !== FILE_WRITE_TOOL_NAME
	) {
		return output
	}
	if (!isEnvTruthy(process.env.CLAUDE_CODE_REMOTE)) return output
	if (!getFeatureValue_CACHED_MAY_BE_STALE('tengu_quartz_lantern', false)) {
		return output
	}
	if (!output || typeof output !== 'object') return output

	const fileOutput = output as FileToolOutput
	if (fileOutput.gitDiff) return output
	if (typeof fileOutput.filePath !== 'string') return output

	const startTime = Date.now()
	let diff: Awaited<ReturnType<typeof fetchSingleFileGitDiff>> = null
	try {
		diff = await fetchSingleFileGitDiff(expandPath(fileOutput.filePath))
	} catch {
		diff = null
	} finally {
		logEvent('tengu_tool_use_diff_computed', {
			isEditTool: toolName === FILE_EDIT_TOOL_NAME,
			isWriteTool: toolName === FILE_WRITE_TOOL_NAME,
			durationMs: Date.now() - startTime,
			hasDiff: !!diff,
		})
	}
	if (!diff) return output

	return {...fileOutput, gitDiff: diff}
}
