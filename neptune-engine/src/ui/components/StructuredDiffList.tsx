import type {StructuredPatchHunk} from 'diff'
import * as React from 'react'
import {Box, Text} from '@anthropic/ink'
import {expectColorDiff} from './StructuredDiff/colorDiff.js'

type Props = {
	hunks: StructuredPatchHunk[]
	dim: boolean
	width: number
	filePath: string
	firstLine: string | null
	fileContent?: string
}

export function StructuredDiffList({
	hunks,
	dim,
	width,
	filePath,
	firstLine,
	fileContent,
}: Props): React.ReactNode {
	const ColorDiff = expectColorDiff()
	const lines = ColorDiff
		? hunks.flatMap(hunk => {
				const colorDiff = new ColorDiff(hunk, firstLine, filePath, fileContent)
				return colorDiff.render('dark', width, dim) ?? []
			})
		: hunks.flatMap(hunk => hunk.lines)

	return (
		<Box flexDirection="column">
			{lines.map((line, index) => (
				<Text key={index} dimColor={dim}>
					{line}
				</Text>
			))}
		</Box>
	)
}
