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

    setIsStreaming(true);

    // Add user message
    const userMsg: ChatMessage = {
      id: genId(),
      role: 'user',
      blocks: [{ type: 'text', content }],
      status: 'complete',
    };

    const assistantId = genId();
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      blocks: [{ type: 'thinking', content: '思考中...' }],
      status: 'streaming',
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
        const { type, data } = event;

        if (type === 'text') {
          // 处理文本事件：支持增量追加实现逐字打印效果
          const { content: textContent = '', isDelta } = data as { content?: string; isDelta?: boolean };
          if (isDelta) {
            // 增量内容：追加到最后一个 text block
            setBlocks(prev => {
              const lastBlock = prev[prev.length - 1];
              if (lastBlock?.type === 'text') {
                // 追加到现有 text block
                return [
                  ...prev.slice(0, -1),
                  { ...lastBlock, content: lastBlock.content + textContent }
                ];
              }
              // 首次到达文本内容：移除 thinking block，创建第一个 text block
              const filtered = prev.filter(b => b.type !== 'thinking');
              return [...filtered, { type: 'text', content: textContent }];
            });
          } else {
            // 非增量：移除 thinking block，创建新的 text block
            setBlocks(prev => {
              const filtered = prev.filter(b => b.type !== 'thinking');
              return [...filtered, { type: 'text', content: textContent }];
            });
          }
        } else if (type === 'tool_use') {
          const { id: toolId, name, input } = data as { id: string; name: string; input: Record<string, unknown> };
          setBlocks(prev => [...prev, { type: 'tool_use', id: toolId, name, input, status: 'running' }]);
        } else if (type === 'tool_status') {
          const { id: toolId, status: toolStatus } = data as { id: string; status: string };
          setBlocks(prev => prev.map(b =>
            b.type === 'tool_use' && b.id === toolId
              ? { ...b, status: (toolStatus === 'completed' ? 'completed' : 'running') as 'running' | 'completed' }
              : b
          ));
        } else if (type === 'tool_result') {
          const { toolUseId, output } = data as { toolUseId: string; output: unknown };
          setBlocks(prev => [...prev, { type: 'tool_result', toolUseId, output: output as Record<string, unknown> }]);
        } else if (type === 'error') {
          const { message: errorMsg } = data as { message?: string };
          setBlocks(prev => [...prev, { type: 'text', content: `Error: ${errorMsg || 'Unknown error occurred'}` }]);
          setStatus('complete');
        } else if (type === 'thinking') {
          const thinkingContent = (data as { content?: string }).content || '';
          setBlocks(prev => [...prev, { type: 'thinking', content: thinkingContent, duration: 0 }]);
        }
      },
      onError: (error) => {
        console.error('SSE error:', error);
        setBlocks([{ type: 'text', content: `Connection error: ${error.message}` }]);
        setStatus('complete');
      },
      onDone: () => {
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

  return { getMessages, getPlanTasks, getBackgroundTasks, sendMessage, addInitialMessages, loadHistory, isStreaming, abortStream };
}
