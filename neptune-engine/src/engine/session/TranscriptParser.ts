/**
 * TranscriptParser — JSONL 对话文件解析器
 *
 * 读取 Claude Code 生成的 JSONL transcript 文件，逐行解析为消息数组。
 * 跳过空行和格式错误的行，不会因单行异常而崩溃。
 */

import { readFileSync, existsSync } from 'fs'
import { randomUUID } from 'crypto'
import { LogUtil } from '../log/LogUtil.js'

/** transcript 中的单条消息 */
export interface TranscriptMessage {
  type: string
  role: 'user' | 'assistant'
  content: unknown[] | string
}

/**
 * 解析 JSONL transcript 文件，返回消息数组
 * - 跳过空行
 * - 跳过 JSON 解析失败的行
 * - 文件不存在时返回空数组
 */
export function parseTranscript(filePath: string): TranscriptMessage[] {
  // 文件不存在，返回空数组
  if (!existsSync(filePath)) {
    return []
  }

  const raw = readFileSync(filePath, 'utf-8')
  if (!raw.trim()) {
    return []
  }

  const lines = raw.split('\n')
  const messages: TranscriptMessage[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    // 跳过空行
    if (!trimmed) continue

    try {
      const parsed = JSON.parse(trimmed)
      // 只保留有 role 字段的有效消息
      if (parsed && parsed.role) {
        messages.push(parsed as TranscriptMessage)
      }
    } catch (error) {
      // 跳过格式错误的行
      LogUtil.warn('格式错误行跳过', { line: trimmed.substring(0, 100), error: String(error) })
    }
  }

  return messages
}

/**
 * 将 TranscriptMessage[] 转换为 QueryEngine 接受的 Message[] 格式
 *
 * QueryEngine.Message 结构：
 *   { type: 'user'|'assistant', uuid, message: { role, content } }
 *
 * TranscriptMessage 结构（JSONL 每行）：
 *   { type: 'human'|'assistant', role: 'user'|'assistant', content: [...] }
 */
export interface QueryEngineMessage {
  type: 'user' | 'assistant'
  uuid: string
  message: {
    role: 'user' | 'assistant'
    content: unknown[] | string
  }
}

export function transcriptToMessages(transcript: TranscriptMessage[]): QueryEngineMessage[] {
  return transcript
    .filter(t => t.role === 'user' || t.role === 'assistant')
    .map(t => {
      // 映射 type：JSONL 中 user 消息 type 为 'human'，需要映射为 'user'
      const msgType = t.role === 'user' ? 'user' : 'assistant'
      return {
        type: msgType,
        uuid: randomUUID(),
        message: {
          role: t.role,
          content: t.content,
        },
      }
    })
}
