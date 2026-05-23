/**
 * SSE 事件映射器 — 将 SDK QueryEvent 映射为前端 SSE 事件
 *
 * SDK engine.query() 返回的事件格式：
 * - { type: 'system', subtype: 'init', ... }
 * - { type: 'assistant', message: { content: [{ type: 'text', text: '...' }] } }
 * - { type: 'tool_use', ... }
 * - { type: 'tool_result', ... }
 * - { type: 'result', subtype: 'success'|'error', ... }
 * - { type: 'error' | 'assistant_error', ... }
 * - { type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: '...' } } }
 *
 * 前端 SSE 事件格式：
 * - { type: 'text', content: '...', isDelta?: boolean }
 * - { type: 'tool_use', id, name, input, status }
 * - { type: 'tool_result', toolUseId, output }
 * - { type: 'tool_status', id, status }
 * - { type: 'error', message }
 * - { type: 'done', usage? }
 * - { type: 'plan_created', planId, title, totalSteps, createdAt }
 * - { type: 'plan_step', planId, stepId, stepNumber, subject, status, ... }
 * - { type: 'plan_done', planId, status, duration, completedAt }
 */

import type {
    ChatMessageEvent,
    ChatPlanCreatedEvent,
    ChatPlanDoneEvent,
    ChatPlanStepEvent,
    ChatStreamEvent,
} from '@shared/neptune-ai';
import {toApiErrorEnvelope} from '../utils/api-error.js';

export type SSEPlanCreatedEvent = ChatPlanCreatedEvent;
export type SSEPlanStepEvent = ChatPlanStepEvent;
export type SSEPlanDoneEvent = ChatPlanDoneEvent;
export type SSEPlanEvent = ChatPlanCreatedEvent | ChatPlanStepEvent | ChatPlanDoneEvent;
export type SSEEvent = ChatStreamEvent;
export type SSEMappedEvent = ChatMessageEvent | Extract<ChatStreamEvent, {type: 'error'}>;

// ===== 辅助函数 =====

/**
 * 从 assistant 事件中提取文本内容
 * 支持两种格式：
 * 1. { type: 'assistant', content: 'text' }  — 类型定义格式
 * 2. { type: 'assistant', message: { content: [{ type: 'text', text: '...' }] } } — 实际运行时格式
 */
function extractAssistantText(event: Record<string, unknown>): string {
    // 格式 1: event.content 直接是字符串
    if (typeof event.content === 'string') {
        return event.content;
    }

    // 格式 2: event.message.content 是数组
    const message = event.message as Record<string, unknown> | undefined;
    if (message?.content && Array.isArray(message.content)) {
        // 提取所有 text 类型的 content block
        const texts = message.content
            .filter((block: any) => block.type === 'text' && typeof block.text === 'string')
            .map((block: any) => block.text);
        return texts.join('');
    }

    return '';
}

/**
 * 从 error 事件中提取错误消息
 */
function extractErrorEnvelope(event: Record<string, unknown>) {
    const rawError = event.error ?? event.result ?? event;
    const {envelope} = toApiErrorEnvelope(rawError, {
        error: 'INTERNAL_ERROR',
        message: extractErrorMessage(event),
        requestId: typeof event.requestId === 'string' ? event.requestId : undefined,
    });
    return envelope;
}

function extractErrorMessage(event: Record<string, unknown>): string {
    // event.error 可能是 Error 对象、字符串、或 undefined
    const error = event.error;
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object') {
        const errObj = error as Record<string, unknown>;
        if (typeof errObj.message === 'string') return errObj.message;
    }
    return 'Unknown error';
}

// ===== 映射函数 =====

/**
 * 将 SDK 事件映射为前端 SSE 事件数组
 *
 * 处理逻辑：
 * - stream_event (text_delta) -> { type: 'text', content: delta, isDelta: true }
 * - assistant -> { type: 'text', content: fullText } (但会被调用方过滤如果已收到过 stream_event)
 * - tool_use -> { type: 'tool_use', ... }
 * - tool_result -> { type: 'tool_result', ... } + { type: 'tool_status', ... }
 */
export function mapSSEEvent(sdkEvent: Record<string, unknown>): SSEMappedEvent[] {
    const eventType = sdkEvent.type as string;

    switch (eventType) {
        case 'stream_event': {
            // 处理 SDK 流式增量事件
            const event = sdkEvent.event as Record<string, unknown> | undefined;
            if (event?.type === 'content_block_delta') {
                const delta = event.delta as {
                    type: string;
                    text?: string;
                    thinking?: string;
                    partial_json?: string
                } | undefined;
                if (delta?.type === 'text_delta' && delta.text) {
                    return [{
                        type: 'text',
                        content: delta.text,
                        isDelta: true,
                    }];
                }
                if (delta?.type === 'thinking_delta' && delta.thinking) {
                    return [{
                        type: 'thinking',
                        content: delta.thinking,
                        isDelta: true,
                    }];
                }
                if (delta?.type === 'input_json_delta' && delta.partial_json) {
                    // Tool input streaming — ignore (wait for top-level tool_use event)
                    return [];
                }
            }
            // content_block_start with thinking type
            if (event?.type === 'content_block_start') {
                const contentBlock = event.content_block as {
                    type: string;
                    thinking?: string;
                    id?: string;
                    name?: string
                } | undefined;
                if (contentBlock?.type === 'thinking') {
                    return [{
                        type: 'thinking',
                        content: contentBlock.thinking || '',
                    }];
                }
                // tool_use 的 content_block_start 不在这里处理
                // 等待顶层 tool_use 事件（携带正确的 tool_use_id）
            }
            return [];
        }

        case 'assistant': {
            const text = extractAssistantText(sdkEvent);
            if (!text) return []; // 没有文本内容则跳过
            // 返回完整文本
            // 注意：调用方负责过滤，如果已收到过 stream_event 则跳过
            return [{type: 'text', content: text}];
        }

        case 'tool_use': {
            const toolName = String(sdkEvent.name || '');
            const toolId = String(sdkEvent.id || '');
            const input = (sdkEvent.input as Record<string, unknown>) || {};

            // AskUserQuestion 特殊处理 — 转为 ask_user 事件
            if (toolName === 'AskUserQuestion') {
                const questions = (input.questions as Array<Record<string, unknown>>) || [];
                return [{
                    type: 'ask_user',
                    id: toolId,
                    questions: questions.map(q => ({
                        question: String(q.question || ''),
                        header: q.header ? String(q.header) : undefined,
                        options: ((q.options as Array<Record<string, unknown>>) || []).map(o => ({
                            label: String(o.label || ''),
                            description: o.description ? String(o.description) : undefined,
                        })),
                        multiSelect: Boolean(q.multiSelect),
                    })),
                }];
            }

            const events: ChatMessageEvent[] = [{
                type: 'tool_use',
                id: toolId,
                name: toolName,
                input,
                status: 'running',
            }];

            // Write 工具写入文档时，额外生成 artifact 事件
            if (toolName === 'Write' && input.file_path && input.content) {
                const filePath = String(input.file_path);
                const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
                const docExtensions = ['.md', '.html', '.htm', '.txt', '.json', '.csv', '.xml', '.yaml', '.yml'];
                if (docExtensions.includes(ext)) {
                    const fileName = filePath.split('/').pop() || filePath;
                    events.push({
                        type: 'artifact',
                        id: `artifact-${toolId}`,
                        title: fileName,
                        fileType: ext,
                        content: String(input.content),
                    });
                }
            }

            return events;
        }

        case 'tool_result': {
            const events: ChatMessageEvent[] = [];
            const toolUseId = String(sdkEvent.toolUseId || sdkEvent.tool_use_id || '');

            events.push({
                type: 'tool_result',
                toolUseId,
                output: sdkEvent.content ?? sdkEvent.output,
            });

            events.push({
                type: 'tool_status',
                id: toolUseId,
                status: sdkEvent.isError ? 'error' : 'completed',
            });

            return events;
        }

        case 'system':
            // 系统消息不发给前端
            return [];

        case 'result': {
            // result 事件表示查询完成
            // 成功完成时由路由层发 event: done，这里只处理错误
            if (sdkEvent.is_error || sdkEvent.subtype === 'error') {
                const envelope = extractErrorEnvelope(sdkEvent);
                return [{
                    type: 'error',
                    error: envelope.error,
                    message: envelope.message,
                    requestId: envelope.requestId,
                    details: envelope.details,
                }];
            }
            return [];
        }

        case 'error':
        case 'assistant_error': {
            const envelope = extractErrorEnvelope(sdkEvent);
            return [{
                type: 'error',
                error: envelope.error,
                message: envelope.message,
                requestId: envelope.requestId,
                details: envelope.details,
            }];
        }

        default:
            // 未知类型：如果有 content 字段，作为 text 传递
            if (typeof sdkEvent.content === 'string' && sdkEvent.content) {
                return [{type: 'text', content: sdkEvent.content}];
            }
            return [];
    }
}
