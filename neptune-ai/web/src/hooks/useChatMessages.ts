import { useState, useCallback, useRef } from 'react';
import { sendThreadMessage, getThreadHistory } from '../api/threads';
import type { ChatMessage, MessageBlock, PlanTask, BackgroundTask } from '../types/chat';

let msgIdCounter = 0;
const genId = () => `msg-${++msgIdCounter}-${Date.now()}`;

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
      // API returns raw history items; map them to ChatMessage format
      // The actual mapping depends on the server response shape
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
        }));
        setMessagesByThread(prev => ({ ...prev, [threadId]: messages }));
      }
    } catch (err) {
      console.error('Failed to load thread history:', err);
    }
  }, []);

  const sendMessage = useCallback((agentId: string, threadId: string, content: string) => {
    if (isStreaming) return;

    // Abort any existing stream
    if (abortRef.current) {
      abortRef.current.abort();
    }

    setIsStreaming(true);

    // Add user message
    const userMsg: ChatMessage = {
      id: genId(),
      role: 'user',
      blocks: [{ type: 'text', content }],
      status: 'complete',
    };

    // Create assistant message with empty blocks
    const assistantMsg: ChatMessage = {
      id: genId(),
      role: 'assistant',
      blocks: [],
      status: 'streaming',
    };

    setMessagesByThread(prev => ({
      ...prev,
      [threadId]: [...(prev[threadId] || []), userMsg, assistantMsg],
    }));

    // Clear old tasks for this thread when starting new conversation
    setPlanTasksByThread(prev => ({ ...prev, [threadId]: [] }));
    setBgTasksByThread(prev => ({ ...prev, [threadId]: [] }));

    // Send via SSE
    const controller = sendThreadMessage(agentId, threadId, content, {
      onEvent: (event) => {
        setMessagesByThread(prev => {
          const threadMsgs = prev[threadId] || [];
          const lastMsg = threadMsgs[threadMsgs.length - 1];
          if (!lastMsg || lastMsg.role !== 'assistant') return prev;

          const newBlocks = [...lastMsg.blocks];

          switch (event.type) {
            case 'thinking':
              newBlocks.push({
                type: 'thinking',
                content: (event.data as { content?: string }).content || '',
                duration: (event.data as { duration?: number }).duration,
              });
              break;

            case 'text': {
              const textData = event.data as { content?: string };
              const lastBlock = newBlocks[newBlocks.length - 1];
              if (lastBlock?.type === 'text') {
                newBlocks[newBlocks.length - 1] = {
                  ...lastBlock,
                  content: lastBlock.content + (textData.content || ''),
                };
              } else {
                newBlocks.push({ type: 'text', content: textData.content || '' });
              }
              break;
            }

            case 'tool_use':
              newBlocks.push({
                type: 'tool_use',
                id: (event.data as { id?: string }).id || genId(),
                name: (event.data as { name?: string }).name || '',
                input: (event.data as { input?: Record<string, unknown> }).input,
                status: 'running',
              });
              break;

            case 'tool_status': {
              const statusData = event.data as { id?: string; status?: string };
              const toolIdx = newBlocks.findIndex(
                (b): b is Extract<MessageBlock, { type: 'tool_use' }> =>
                  b.type === 'tool_use' && b.id === statusData.id
              );
              if (toolIdx >= 0) {
                newBlocks[toolIdx] = {
                  ...newBlocks[toolIdx],
                  status: (statusData.status as 'completed' | 'error') || 'completed',
                };
              }
              break;
            }

            case 'tool_result':
              newBlocks.push({
                type: 'tool_result',
                toolUseId: (event.data as { toolUseId?: string }).toolUseId || '',
                output: (event.data as { output?: Record<string, unknown> }).output,
              });
              break;

            case 'artifact':
              newBlocks.push({
                type: 'artifact',
                id: (event.data as { id?: string }).id || genId(),
                title: (event.data as { title?: string }).title || '',
                fileType: (event.data as { fileType?: string }).fileType || '',
                content: (event.data as { content?: string }).content || '',
              });
              break;

            case 'plan_task':
              setPlanTasksByThread(prev => ({
                ...prev,
                [threadId]: [...(prev[threadId] || []), (event.data as unknown as PlanTask)],
              }));
              break;

            case 'plan_task_update': {
              const updateData = event.data as { id?: string; status?: PlanTask['status']; activeForm?: string };
              setPlanTasksByThread(prev => {
                const tasks = prev[threadId] || [];
                return {
                  ...prev,
                  [threadId]: tasks.map(t =>
                    t.id === updateData.id
                      ? { ...t, status: updateData.status || t.status, activeForm: updateData.activeForm ?? t.activeForm }
                      : t
                  ),
                };
              });
              break;
            }

            case 'bg_task':
              setBgTasksByThread(prev => ({
                ...prev,
                [threadId]: [...(prev[threadId] || []), (event.data as unknown as BackgroundTask)],
              }));
              break;

            case 'bg_task_update': {
              const bgUpdateData = event.data as { id?: string; status?: BackgroundTask['status']; summary?: string };
              setBgTasksByThread(prev => {
                const tasks = prev[threadId] || [];
                return {
                  ...prev,
                  [threadId]: tasks.map(t =>
                    t.id === bgUpdateData.id
                      ? {
                          ...t,
                          status: bgUpdateData.status || t.status,
                          summary: bgUpdateData.summary ?? t.summary,
                          endTime: (bgUpdateData.status === 'completed' || bgUpdateData.status === 'failed' || bgUpdateData.status === 'killed') ? Date.now() : t.endTime,
                        }
                      : t
                  ),
                };
              });
              break;
            }
          }

          return {
            ...prev,
            [threadId]: threadMsgs.map((m, i) =>
              i === threadMsgs.length - 1 ? { ...m, blocks: newBlocks } : m
            ),
          };
        });
      },

      onError: (error) => {
        console.error('SSE error:', error);
        // Mark the assistant message as complete with error info
        setMessagesByThread(prev => {
          const threadMsgs = prev[threadId] || [];
          const lastMsg = threadMsgs[threadMsgs.length - 1];
          if (!lastMsg || lastMsg.role !== 'assistant') return prev;

          return {
            ...prev,
            [threadId]: threadMsgs.map((m, i) =>
              i === threadMsgs.length - 1
                ? {
                    ...m,
                    status: 'complete' as const,
                    blocks: m.blocks.length > 0
                      ? m.blocks
                      : [{ type: 'text' as const, content: `Error: ${error.message}` }],
                  }
                : m
            ),
          };
        });
        setIsStreaming(false);
      },

      onDone: () => {
        // Mark the assistant message as complete
        setMessagesByThread(prev => {
          const threadMsgs = prev[threadId] || [];
          return {
            ...prev,
            [threadId]: threadMsgs.map((m, i) =>
              i === threadMsgs.length - 1 ? { ...m, status: 'complete' as const } : m
            ),
          };
        });
        setIsStreaming(false);
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

  // Abort ongoing stream
  const abortStream = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  return { getMessages, getPlanTasks, getBackgroundTasks, sendMessage, addInitialMessages, loadHistory, isStreaming, abortStream };
}
