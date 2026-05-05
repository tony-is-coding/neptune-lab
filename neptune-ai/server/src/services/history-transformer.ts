import { randomUUID } from 'crypto';

export interface HistoryMessage {
  id: string;
  role: 'user' | 'assistant';
  blocks: HistoryBlock[];
  status: 'complete';
}

export type HistoryBlock =
  | { type: 'text'; content: string }
  | { type: 'tool_use'; id: string; name: string; input?: Record<string, unknown>; status: string }
  | { type: 'tool_result'; toolUseId: string; output?: unknown }
  | Record<string, unknown>; // fallback for unknown block types

/**
 * 将 transcript.jsonl 的原始行数组转换为前端结构化格式
 */
export function transformHistory(rawMessages: Array<Record<string, unknown>>): HistoryMessage[] {
  return rawMessages
    .filter(msg => msg.role === 'user' || msg.role === 'assistant')
    .map(msg => ({
      id: (msg.id as string) || randomUUID(),
      role: msg.role as 'user' | 'assistant',
      blocks: transformContent(msg.content, msg.role as string),
      status: 'complete' as const,
    }));
}

function transformContent(content: unknown, role: string): HistoryBlock[] {
  if (!content) return [];

  // 纯字符串 → 单个 text block
  if (typeof content === 'string') {
    return [{ type: 'text', content }];
  }

  // 数组 → 逐元素映射
  if (Array.isArray(content)) {
    return content.map(block => transformBlock(block)).filter(Boolean) as HistoryBlock[];
  }

  // 其他 → 尝试作为 text
  return [{ type: 'text', content: JSON.stringify(content) }];
}

function transformBlock(block: unknown): HistoryBlock | null {
  if (!block || typeof block !== 'object') return null;

  const b = block as Record<string, unknown>;

  switch (b.type) {
    case 'text':
      return { type: 'text', content: String(b.text || b.content || '') };
    case 'tool_use':
      return {
        type: 'tool_use',
        id: String(b.id || ''),
        name: String(b.name || ''),
        input: (b.input as Record<string, unknown>) || {},
        status: 'completed',
      };
    case 'tool_result':
      return {
        type: 'tool_result',
        toolUseId: String(b.tool_use_id || b.toolUseId || ''),
        output: b.content,
      };
    default:
      // 未知类型透传
      return { ...b } as Record<string, unknown> as HistoryBlock;
  }
}
