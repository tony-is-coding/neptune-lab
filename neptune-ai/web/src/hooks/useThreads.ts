import { useState, useEffect, useCallback, useRef } from 'react';
import { listThreads, createThread } from '../api/threads';
import type { Thread } from '../types/chat';

export function useThreads(agentId: string) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  // Reset active thread when agent changes
  useEffect(() => {
    setActiveThreadId(null);
  }, [agentId]);

  // Load threads
  const loadThreads = useCallback(async () => {
    if (!agentId) return;
    try {
      const result = await listThreads(agentId);
      setThreads(result.data);
      // If no active thread, select the first one
      setActiveThreadId(prev => {
        if (!prev && result.data.length > 0) {
          return result.data[0].id;
        }
        return prev;
      });
    } catch (err) {
      console.error('Failed to load threads:', err);
    }
  }, [agentId]);

  // Initial load + polling (every 5s)
  useEffect(() => {
    setLoading(true);
    loadThreads().finally(() => setLoading(false));

    intervalRef.current = setInterval(loadThreads, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadThreads]);

  // Create new thread
  const createNewThread = useCallback(async (title?: string) => {
    const thread = await createThread(agentId, title);
    setThreads(prev => [thread, ...prev]);
    setActiveThreadId(thread.id);
    return thread;
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
