import * as React from 'react'
import {Box, Text} from '@anthropic/ink'

type Props = {
	code: string
	filePath: string
	dim?: boolean
	skipColoring?: boolean
}

export function HighlightedCodeFallback({
	code,
	dim = false,
}: Props): React.ReactNode {
	return (
		<Box flexDirection="column">
			{code.split('\n').map((line, index) => (
				<Text key={index} dimColor={dim}>
					{line}
				</Text>
			))}
		</Box>
	)
}
