import { useState, useCallback, useRef } from 'react';
import { sendThreadMessage, getThreadHistory } from '../api/threads';
import type { ChatMessage, MessageBlock, PlanTask, BackgroundTask } from '../types/chat';
import type { ChatErrorEvent } from '@shared/neptune-ai';

let msgIdCounter = 0;
const genId = () => `msg-${++msgIdCounter}-${Date.now()}`;

function formatChatErrorMessage(error: Error, event?: ChatErrorEvent): string {
  if (event?.error === 'QUOTA_EXCEEDED') {
    return [
      event.message || '租户配额不足',
      '',
      '本次运行未启动，系统已写入配额策略拒绝和审计事件。',
      '',
      '查看成本概览：/governance?tab=costs',
      '查看策略决策：/governance?tab=policy',
      event.requestId ? `请求编号：${event.requestId}` : '',
    ].filter(Boolean).join('\n');
  }

  if (event?.error === 'POLICY_DENIED') {
    return [
      event.message || '本次操作被策略拒绝。',
      '',
      '本次运行未启动，请在治理台查看策略决策原因。',
      '',
      '查看策略决策：/governance?tab=policy',
      event.requestId ? `请求编号：${event.requestId}` : '',
    ].filter(Boolean).join('\n');
  }

  return event?.message || error.message;
}

export function useChatMessages() {
  const [messagesByThread, setMessagesByThread] = useState<Record<string, ChatMessage[]>>({});
  const [planTasksByThread, setPlanTasksByThread] = useState<Record<string, PlanTask[]>>({});
  const [bgTasksByThread, setBgTasksByThread] = useState<Record<string, BackgroundTask[]>>({});
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const getMessages = useCallback((threadId: string) => {
    return messagesByThread[threadId] || [];
  }, [messagesByThread]);

  const getPlanTasks = useCallback((threadId: string) => {
    return planTasksByThread[threadId] || [];
  }, [planTasksByThread]);

  const getBackgroundTasks = useCallback((threadId: string) => {
    return bgTasksByThread[threadId] || [];
  }, [bgTasksByThread]);

  // Load thread history from API
  const loadHistory = useCallback(async (agentId: string, threadId: string) => {
    try {
      const result = await getThreadHistory(agentId, threadId);
      const history = result.data as Array<{
        id?: string;
        role?: string;
        content?: string;
        blocks?: MessageBlock[];
        status?: string;
      }>;

      if (Array.isArray(history) && history.length > 0) {
        const messages: ChatMessage[] = history.map(item => ({
          id: item.id || genId(),
          role: (item.role as 'user' | 'assistant') || 'user',
          blocks: item.blocks || (item.content ? [{ type: 'text' as const, content: item.content }] : []),
          status: (item.status as 'streaming' | 'complete') || 'complete',
          createdAt: (item as any).createdAt || undefined,
        }));
        setMessagesByThread(prev => ({ ...prev, [threadId]: messages }));
      }
    } catch (err) {
      console.error('Failed to load thread history:', err);
      throw err;
    }
  }, []);

  const sendMessage = useCallback((agentId: string, threadId: string, content: string) => {
    if (isStreaming) return;

    setIsStreaming(true);

    // Add user message
    const userMsg: ChatMessage = {
      id: genId(),
      role: 'user',
      blocks: [{ type: 'text', content }],
      status: 'complete',
      createdAt: new Date().toISOString(),
    };

    const assistantId = genId();
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      blocks: [{ type: 'thinking', content: '思考中...' }],
      status: 'streaming',
      createdAt: new Date().toISOString(),
    };

    setMessagesByThread(prev => ({
      ...prev,
      [threadId]: [...(prev[threadId] || []), userMsg, assistantMsg],
    }));

    // Clear old tasks
    setPlanTasksByThread(prev => ({ ...prev, [threadId]: [] }));
    setBgTasksByThread(prev => ({ ...prev, [threadId]: [] }));

    // Helper: update blocks for the assistant message
    const setBlocks = (updater: MessageBlock[] | ((prev: MessageBlock[]) => MessageBlock[])) => {
      setMessagesByThread(prev => {
        const threadMsgs = prev[threadId] || [];
        const currentBlocks = (threadMsgs.find(m => m.id === assistantId)?.blocks || []) as MessageBlock[];
        const newBlocks = typeof updater === 'function' ? updater(currentBlocks) : updater;
        return {
          ...prev,
          [threadId]: threadMsgs.map((m) =>
            m.id === assistantId ? { ...m, blocks: newBlocks } : m
          ),
        };
      });
    };

    const setStatus = (status: 'streaming' | 'complete') => {
      setMessagesByThread(prev => {
        const threadMsgs = prev[threadId] || [];
        return {
          ...prev,
          [threadId]: threadMsgs.map((m) =>
            m.id === assistantId ? { ...m, status } : m
          ),
        };
      });
      if (status === 'complete') setIsStreaming(false);
    };

    // Real SSE call
    const controller = sendThreadMessage(agentId, threadId, content, {
      onEvent: (event) => {
        const { type } = event;

        if (type === 'text') {
          // 处理文本事件：支持增量追加实现逐字打印效果
          const { content: textContent = '', isDelta } = event;
          if (isDelta) {
            // 增量内容：追加到最后一个 text block
            setBlocks(prev => {
              // 先将所有 running 的 tool_use 标记为 completed（新 turn 开始意味着工具已完成）
              const updated = prev.map(b =>
                b.type === 'tool_use' && b.status === 'running' ? { ...b, status: 'completed' as const } : b
              );
              const lastBlock = updated[updated.length - 1];
              if (lastBlock?.type === 'text') {
                return [
                  ...updated.slice(0, -1),
                  { ...lastBlock, content: lastBlock.content + textContent }
                ];
              }
              // 首次到达文本内容：保留 thinking block，创建新 text block
              const filtered = updated.filter(b => !(b.type === 'thinking' && b.content === '思考中...'));
              return [...filtered, { type: 'text', content: textContent }];
            });
          } else {
            // 非增量：移除占位 thinking，创建新的 text block
            setBlocks(prev => {
              const updated = prev.map(b =>
                b.type === 'tool_use' && b.status === 'running' ? { ...b, status: 'completed' as const } : b
              );
              const filtered = updated.filter(b => !(b.type === 'thinking' && b.content === '思考中...'));
              return [...filtered, { type: 'text', content: textContent }];
            });
          }
        } else if (type === 'tool_use') {
          const { id: toolId, name, input } = event;

          // TodoWrite 特殊处理 — 转为 plan block
          if (name === 'TodoWrite' && input.todos) {
            const todos = input.todos as Array<{ content: string; status: string; activeForm?: string }>;
            setBlocks(prev => {
              // 更新已有的 plan block，或创建新的
              const existingIdx = prev.findIndex(b => b.type === 'plan');
              const planBlock = { type: 'plan' as const, id: toolId, todos: todos.map(t => ({ content: t.content, status: t.status as PlanTask['status'], activeForm: t.activeForm })) };
              if (existingIdx >= 0) {
                return [...prev.slice(0, existingIdx), planBlock, ...prev.slice(existingIdx + 1)];
              }
              return [...prev, planBlock];
            });
            return;
          }

          setBlocks(prev => {
            // 如果已存在同 id 的 tool_use，更新其 input（流式中 input 可能延迟到达）
            const existing = prev.find(b => b.type === 'tool_use' && b.id === toolId);
            if (existing) {
              return prev.map(b =>
                b.type === 'tool_use' && b.id === toolId
                  ? { ...b, input, name: name || (b as any).name }
                  : b
              );
            }
            return [...prev, { type: 'tool_use', id: toolId, name, input, status: 'running' as const }];
          });
        } else if (type === 'artifact') {
          const { id: artId, title, fileType, content: artContent } = event;
          setBlocks(prev => [...prev, { type: 'artifact', id: artId, title, fileType, content: artContent }]);
        } else if (type === 'tool_status') {
          const { id: toolId, status: toolStatus } = event;
          setBlocks(prev => prev.map(b =>
            b.type === 'tool_use' && b.id === toolId
              ? { ...b, status: toolStatus }
              : b
          ));
        } else if (type === 'tool_result') {
          const { toolUseId, output } = event;
          setBlocks(prev => [...prev, { type: 'tool_result', toolUseId, output: output as Record<string, unknown> }]);
        } else if (type === 'thinking') {
          const { content: thinkingContent = '', isDelta } = event;
          if (isDelta) {
            // 增量思考：追加到最后一个 thinking block
            setBlocks(prev => {
              // 新 thinking 到达 → 之前的 tool_use 已完成
              const updated = prev.map(b =>
                b.type === 'tool_use' && b.status === 'running' ? { ...b, status: 'completed' as const } : b
              );
              const lastBlock = updated[updated.length - 1];
              if (lastBlock?.type === 'thinking') {
                // 如果是占位 block，替换内容而非追加
                if (lastBlock.content === '思考中...') {
                  return [
                    ...updated.slice(0, -1),
                    { ...lastBlock, content: thinkingContent }
                  ];
                }
                return [
                  ...updated.slice(0, -1),
                  { ...lastBlock, content: lastBlock.content + thinkingContent }
                ];
              }
              // 没有现有 thinking block，创建新的
              return [...updated, { type: 'thinking', content: thinkingContent, duration: 0 }];
            });
          } else {
            // 非增量 thinking（content_block_start）：
            setBlocks(prev => {
              const updated = prev.map(b =>
                b.type === 'tool_use' && b.status === 'running' ? { ...b, status: 'completed' as const } : b
              );
              const lastBlock = updated[updated.length - 1];
              if (lastBlock?.type === 'thinking') {
                // 占位 block → 替换
                if (lastBlock.content === '思考中...') {
                  return [
                    ...updated.slice(0, -1),
                    { type: 'thinking', content: thinkingContent, duration: 0 }
                  ];
                }
                // 已有真实 thinking block，合并（多轮思考）
                const separator = lastBlock.content && thinkingContent ? '\n\n' : '';
                return [
                  ...updated.slice(0, -1),
                  { ...lastBlock, content: lastBlock.content + separator + thinkingContent }
                ];
              }
              return [...updated, { type: 'thinking', content: thinkingContent, duration: 0 }];
            });
          }
        } else if (type === 'ask_user') {
          const { id: askId, questions } = event;
          setBlocks(prev => [...prev, { type: 'ask_user', id: askId, questions, answered: false }]);
        } else if (type === 'plan_created') {
          // Plan 创建：初始化任务列表
          setPlanTasksByThread(prev => ({ ...prev, [threadId]: [] }));
        } else if (type === 'plan_step') {
          // Plan 步骤更新
          const step = event;
          setPlanTasksByThread(prev => {
            const tasks = [...(prev[threadId] || [])];
            const existingIdx = tasks.findIndex(t => t.id === step.stepId);
            const task: PlanTask = {
              id: step.stepId,
              subject: step.subject,
              description: '',
              activeForm: step.activeForm,
              status: step.status,
              blocks: [],
              blockedBy: [],
            };
            if (existingIdx >= 0) {
              tasks[existingIdx] = { ...tasks[existingIdx], ...task };
            } else {
              tasks.push(task);
            }
            return { ...prev, [threadId]: tasks };
          });
        } else if (type === 'plan_done') {
          // Plan 完成：标记所有未完成的为 completed
          setPlanTasksByThread(prev => {
            const tasks = (prev[threadId] || []).map(t =>
              t.status !== 'completed' ? { ...t, status: 'completed' as const } : t
            );
            return { ...prev, [threadId]: tasks };
          });
        }
      },
      onError: (error, event) => {
        console.error('SSE error:', error);
        setBlocks(prev => {
          const filtered = prev.filter(b => !(b.type === 'thinking' && b.content === '思考中...'));
          return [...filtered, { type: 'text', content: formatChatErrorMessage(error, event) }];
        });
        setStatus('complete');
      },
      onDone: () => {
        // 流结束时，将所有 running 的 tool_use 标记为 completed
        setBlocks(prev => prev.map(b =>
          b.type === 'tool_use' && b.status === 'running' ? { ...b, status: 'completed' as const } : b
        ));
        setStatus('complete');
      },
    });

    abortRef.current = controller;
  }, [isStreaming]);

  const addInitialMessages = useCallback((threadId: string, messages: ChatMessage[]) => {
    setMessagesByThread(prev => {
      if (prev[threadId] && prev[threadId].length > 0) return prev;
      return { ...prev, [threadId]: messages };
    });
  }, []);

  const abortStream = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  /** Update a specific block in the current streaming message (e.g. mark ask_user as answered) */
  const updateBlock = useCallback((threadId: string, blockId: string, patch: Partial<MessageBlock>) => {
    setMessagesByThread(prev => {
      const msgs = prev[threadId];
      if (!msgs) return prev;
      const updated = msgs.map(msg => ({
        ...msg,
        blocks: msg.blocks.map(b =>
          ('id' in b && (b as any).id === blockId) ? { ...b, ...patch } as MessageBlock : b
        ),
      }));
      return { ...prev, [threadId]: updated };
    });
  }, []);

  return { getMessages, getPlanTasks, getBackgroundTasks, sendMessage, addInitialMessages, loadHistory, isStreaming, abortStream, updateBlock };
}
