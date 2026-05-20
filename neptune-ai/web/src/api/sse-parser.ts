export interface SSEFrame {
  event: string
  data: unknown
}

export interface SSEParseResult {
  frames: SSEFrame[]
  buffer: string
}

/**
 * Incrementally parse SSE frames from a streaming text chunk.
 *
 * The parser keeps unfinished frame text in `buffer`, supports multi-line data
 * fields, and ignores malformed JSON frames instead of breaking the whole stream.
 */
export function parseSSEChunk(previousBuffer: string, chunk: string): SSEParseResult {
  const combined = previousBuffer + chunk
  const parts = combined.split(/\n\n/)
  const buffer = parts.pop() ?? ''
  const frames: SSEFrame[] = []

  for (const part of parts) {
    const lines = part.split(/\n/)
    let event = ''
    const dataLines: string[] = []

    for (const line of lines) {
      if (line.startsWith('event:')) {
        event = line.slice('event:'.length).trimStart()
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice('data:'.length).trimStart())
      }
    }

    if (!event || dataLines.length === 0) continue

    try {
      frames.push({event, data: JSON.parse(dataLines.join('\n'))})
    } catch {
      // Malformed frames are ignored; the next complete frame can still proceed.
    }
  }

  return {frames, buffer}
}
