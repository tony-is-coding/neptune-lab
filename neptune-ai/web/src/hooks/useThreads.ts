import { useState, useEffect, useCallback, useRef } from 'react';
import { listThreads, createThread } from '../api/threads';
import type { Thread } from '../types/chat';

/**
 * 后端状态到前端状态的映射
 * 后端: 'created' | 'running' | 'idle' | 'completed' | 'error'
 * 前端: 'idle' | 'running' | 'error'
 */
function mapThreadStatus(backendStatus: string): Thread['status'] {
  switch (backendStatus) {
    case 'running':
      return 'running';
    case 'error':
      return 'error';
    case 'created':
    case 'idle':
    case 'completed':
    default:
      return 'idle';
  }
}

export function useThreads(agentId: string) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const initializedRef = useRef(false);

  // Reset active thread when agent changes
  useEffect(() => {
    setActiveThreadId(null);
    initializedRef.current = false;
  }, [agentId]);

  // Load threads from API
  const loadThreads = useCallback(async () => {
    if (!agentId) return;

    try {
      setLoading(true);
      const result = await listThreads(agentId);

      // 映射后端状态到前端状态
      const mappedThreads: Thread[] = result.data.map(thread => ({
        ...thread,
        status: mapThreadStatus(thread.status),
      }));

      setThreads(mappedThreads);

      // 如果没有 active thread，选择第一个（如果有的话）
      setActiveThreadId(prev => {
        if (!prev && mappedThreads.length > 0) {
          return mappedThreads[0].id;
        }
        return prev;
      });
    } catch (err) {
      console.error('Failed to load threads:', err);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  // Initial load + polling (every 5s)
  useEffect(() => {
    if (!agentId) return;

    loadThreads();

    intervalRef.current = setInterval(loadThreads, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadThreads]);

  // Create new thread
  const createNewThread = useCallback(async (title?: string): Promise<Thread> => {
    if (!agentId) {
      throw new Error('Agent ID is required');
    }

    try {
      const newThread = await createThread(agentId, title);

      // 映射后端状态到前端状态
      const mappedThread: Thread = {
        ...newThread,
        status: mapThreadStatus(newThread.status),
      };

      setThreads(prev => [mappedThread, ...prev]);
      setActiveThreadId(mappedThread.id);

      return mappedThread;
    } catch (err) {
      console.error('Failed to create thread:', err);
      throw err;
    }
  }, [agentId]);

  // Switch thread
  const switchThread = useCallback((threadId: string) => {
    setActiveThreadId(threadId);
  }, []);

  return {
    threads,
    activeThreadId,
    activeThread: threads.find(t => t.id === activeThreadId) || null,
    loading,
    loadThreads,
    createNewThread,
    switchThread,
  };
}
