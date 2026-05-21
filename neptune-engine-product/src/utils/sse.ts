/**
 * SSE (Server-Sent Events) frame parsing utilities.
 *
 * This module provides a zero-dependency parser for SSE frames, supporting
 * incremental parsing of streaming text buffers. Handles both LF (\n) and
 * CRLF (\r\n) line endings.
 *
 * @module utils/sse
 */

/**
 * Represents a single SSE frame with optional event, id, and data fields.
 *
 * Per SSE specification:
 * - `event`: The event type (defaults to "message" if omitted)
 * - `id`: The event ID for reconnection scenarios
 * - `data`: The payload data (multiple data: lines are concatenated with \n)
 *
 * @public
 */
export type SSEFrame = {
	event?: string
	id?: string
	data?: string
}

/**
 * Incrementally parse SSE frames from a text buffer.
 *
 * This function parses SSE frames from a potentially incomplete buffer,
 * returning both the fully parsed frames and any remaining incomplete
 * data that should be buffered for the next call.
 *
 * Supports:
 * - Both LF (\n) and CRLF (\r\n) line endings
 * - Mixed line endings within the same stream
 * - SSE comment lines (starting with `:`)
 * - Multiple data: lines (concatenated with \n per spec)
 * - Event, ID, and data fields
 *
 * @param buffer - The text buffer to parse (may contain partial frames)
 * @returns An object containing:
 *   - `frames`: Array of fully parsed SSE frames
 *   - `remaining`: Incomplete trailing data that should be buffered
 *
 * @example
 * ```ts
 * const { frames, remaining } = parseSSEFrames('event: hello\ndata: world\n\n')
 * // frames: [{ event: 'hello', data: 'world' }]
 * // remaining: ''
 * ```
 *
 * @public
 */
export function parseSSEFrames(buffer: string): {
	frames: SSEFrame[]
	remaining: string
} {
	const frames: SSEFrame[] = []
	let pos = 0

	// SSE frames are delimited by an empty line. Support LF and CRLF streams.
	const frameDelimiter = /\r?\n\r?\n/g
	frameDelimiter.lastIndex = pos

	let delimiterMatch: RegExpExecArray | null
	while ((delimiterMatch = frameDelimiter.exec(buffer)) !== null) {
		const frameEnd = delimiterMatch.index
		const rawFrame = buffer.slice(pos, frameEnd)
		pos = frameEnd + delimiterMatch[0].length

		// Skip empty frames
		if (!rawFrame.trim()) continue

		const frame: SSEFrame = {}
		let isComment = false

		for (const rawLine of rawFrame.split('\n')) {
			// Normalize CRLF lines in mixed-line-ending streams.
			const line =
				rawLine[rawLine.length - 1] === '\r'
					? rawLine.slice(0, -1)
					: rawLine

			if (line.startsWith(':')) {
				// SSE comment (e.g., `:keepalive`)
				isComment = true
				continue
			}

			const colonIdx = line.indexOf(':')
			if (colonIdx === -1) continue

			const field = line.slice(0, colonIdx)
			// Per SSE spec, strip one leading space after colon if present
			const value =
				line[colonIdx + 1] === ' '
					? line.slice(colonIdx + 2)
					: line.slice(colonIdx + 1)

			switch (field) {
				case 'event':
					frame.event = value
					break
				case 'id':
					frame.id = value
					break
				case 'data':
					// Per SSE spec, multiple data: lines are concatenated with \n
					frame.data = frame.data ? frame.data + '\n' + value : value
					break
				// Ignore other fields (retry:, etc.)
			}
		}

		// Only emit frames that have data (or are pure comments which reset liveness)
		if (frame.data || isComment) {
			frames.push(frame)
		}
	}

	return {frames, remaining: buffer.slice(pos)}
}
