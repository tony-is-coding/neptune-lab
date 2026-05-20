import type {Tokens} from 'marked'
import * as React from 'react'
import {Box, Text} from '@anthropic/ink'
import type {CliHighlight} from 'claude-code-best/utils/cliHighlight.js'

type Props = {
	token: Tokens.Table
	highlight: CliHighlight | null
}

export function MarkdownTable({token}: Props): React.ReactNode {
	const rows = [
		token.header.map(cell => cell.text),
		...token.rows.map(row => row.map(cell => cell.text)),
	]
	const widths = rows[0]?.map((_, columnIndex) =>
		Math.max(...rows.map(row => row[columnIndex]?.length ?? 0)),
	)

	return (
		<Box flexDirection="column">
			{rows.map((row, rowIndex) => (
				<Text key={rowIndex}>
					{row
						.map((cell, columnIndex) =>
							cell.padEnd(widths?.[columnIndex] ?? cell.length),
						)
						.join('  ')}
				</Text>
			))}
		</Box>
	)
}
