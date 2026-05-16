import {randomUUID} from 'crypto';

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
 *
 * 支持两种 JSONL 格式：
 * 1. SDK 格式: { type: "user"|"assistant", message: { role, content } }
 * 2. 旧格式:   { role: "user"|"assistant", content: ... }
 */
export function transformHistory(rawMessages: Array<Record<string, unknown>>): HistoryMessage[] {
    const results: HistoryMessage[] = [];

    for (const msg of rawMessages) {
        const normalized = normalizeMessage(msg);
        if (!normalized) continue;

        const {role, content} = normalized;

        // 跳过 tool_result 类型的 "user" 消息（SDK 中 tool_result 以 user role 发送）
        if (role === 'user' && Array.isArray(content)) {
            const isToolResult = content.every((b: any) => b.type === 'tool_result');
            if (isToolResult) continue;
        }

        if (role !== 'user' && role !== 'assistant') continue;

        const blocks = transformContent(content, role);

        // 跳过空 blocks 的消息（如纯 thinking 的 assistant 消息）
        const meaningfulBlocks = blocks.filter(b => {
            if (b.type === 'text' && !(b as any).content) return false;
            return true;
        });
        if (meaningfulBlocks.length === 0) continue;

        results.push({
            id: randomUUID(),
            role: role as 'user' | 'assistant',
            blocks: meaningfulBlocks,
            status: 'complete',
        });
    }

    return results;
}

/**
 * 将 SDK 格式或旧格式统一为 { role, content }
 */
function normalizeMessage(msg: Record<string, unknown>): { role: string; content: unknown } | null {
    // SDK 格式: { type: "user"|"assistant", message: { role, content } }
    if (msg.message && typeof msg.message === 'object') {
        const inner = msg.message as Record<string, unknown>;
        const role = (inner.role as string) || (msg.type as string);
        const content = inner.content;
        if (role && content !== undefined) {
            return {role, content};
        }
    }

    // 旧格式: { role, content }
    if (msg.role && msg.content !== undefined) {
        return {role: msg.role as string, content: msg.content};
    }

    return null;
}

function transformContent(content: unknown, role: string): HistoryBlock[] {
    if (!content) return [];

    // 纯字符串 → 单个 text block
    if (typeof content === 'string') {
        return [{type: 'text', content}];
    }

    // 数组 → 逐元素映射，同时关联 tool_use 和 tool_result
    if (Array.isArray(content)) {
        const blocks: HistoryBlock[] = [];
        const toolResults = new Map<string, Record<string, unknown>>();

        // 先收集所有 tool_result，建立 tool_use_id → result 映射
        for (const item of content) {
            if (item && typeof item === 'object' && item.type === 'tool_result') {
                toolResults.set(String(item.tool_use_id || ''), item);
            }
        }

        for (const item of content) {
            const block = transformBlock(item, toolResults);
            if (block) blocks.push(block);
        }

        return blocks;
    }

    // 其他 → 尝试作为 text
    return [{type: 'text', content: JSON.stringify(content)}];
}

function transformBlock(block: unknown, toolResults?: Map<string, Record<string, unknown>>): HistoryBlock | null {
    if (!block || typeof block !== 'object') return null;

    const b = block as Record<string, unknown>;

    switch (b.type) {
        case 'text':
            return {type: 'text', content: String(b.text || b.content || '')};
        case 'thinking': {
            // SDK thinking block: { type: 'thinking', thinking: '...' }
            const thinkingText = String(b.thinking || b.content || '');
            if (!thinkingText) return null;
            return {type: 'thinking', content: thinkingText} as unknown as HistoryBlock;
        }
        case 'tool_use': {
            const toolId = String(b.id || '');
            // 检查是否有对应的 tool_result → 标记为 completed
            const hasResult = toolResults?.has(toolId);
            return {
                type: 'tool_use',
                id: toolId,
                name: String(b.name || ''),
                input: (b.input as Record<string, unknown>) || {},
                status: hasResult ? 'completed' : 'completed', // 历史中的 tool_use 都已完成
            };
        }
        case 'tool_result':
            // tool_result 不单独渲染（已在 tool_use 中关联）
            return null;
        default:
            // 未知类型透传
            return {...b} as Record<string, unknown> as HistoryBlock;
    }
}
