import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useResizableSidebar } from '../hooks/useResizableSidebar';
import { useChatMessages } from '../hooks/useChatMessages';
import { useThreads } from '../hooks/useThreads';
import { listAgentsWithSummary } from '../api/agents';
import { replyToQuestion } from '../api/threads';
import { UserMessage } from '../components/chat/UserMessage';
import { AssistantMessage } from '../components/chat/AssistantMessage';
import { ChatInput } from '../components/chat/ChatInput';
import { ArtifactPanel } from '../components/artifact/ArtifactPanel';
import { FloatingPlanPanel } from '../components/chat/FloatingPlanPanel';
import {
  EmptyCollaborateView,
  AgentWelcomeView,
  AgentInactiveBanner,
  AgentRemovedBanner,
  ThreadDropdown,
} from '../components/collaborate';
import type { AgentWithSummary, MessageBlock } from '../types/chat';

type RightPanel = 'none' | 'canvas';

export function Collaborate() {
  const { agentId } = useParams<{ agentId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Agent list (left sidebar) - 现在使用 AgentWithSummary 类型
  const [agents, setAgents] = useState<AgentWithSummary[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { sidebarWidth, isResizing, startResizing } = useResizableSidebar(240, 200, 400);

  // Active agent
  const activeAgent = agents.find((a) => a.id === agentId) || null;

  // Thread management
  const {
    threads,
    activeThreadId,
    activeThread,
    loading: threadsLoading,
    createNewThread,
    switchThread,
  } = useThreads(agentId || '');

  // Chat
  const { getMessages, getPlanTasks, sendMessage, loadHistory, isStreaming, updateBlock } = useChatMessages();
  const messages = getMessages(activeThreadId || '');
  const planTasks = getPlanTasks(activeThreadId || '');

  // 从 messages 中提取最新的 plan todos（用于 FloatingPlanPanel）
  const currentPlanTodos = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === 'assistant') {
        for (let j = msg.blocks.length - 1; j >= 0; j--) {
          const block = msg.blocks[j];
          if (block.type === 'plan') {
            return block.todos;
          }
        }
      }
    }
    return [];
  })();

  // UI state
  const [rightPanel, setRightPanel] = useState<RightPanel>('none');
  const [activeArtifact, setActiveArtifact] = useState<Extract<MessageBlock, { type: 'artifact' }> | null>(null);
  const [agentRemoved, setAgentRemoved] = useState(false);
  const [threadLoadError, setThreadLoadError] = useState<string | null>(null);
  const [isSwitchingThread, setIsSwitchingThread] = useState(false);

  const initialMessageProcessed = useRef(false);
  const lastThreadRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 过滤后的 Agent 列表
  const filteredAgents = agents.filter((agent) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      agent.name.toLowerCase().includes(query) ||
      (agent.description && agent.description.toLowerCase().includes(query))
    );
  });

  // Load agents on mount - 使用 listAgentsWithSummary 加载所有 Agent（含 inactive）
  useEffect(() => {
    let cancelled = false;
    setAgentsLoading(true);
    setAgentRemoved(false);

    listAgentsWithSummary()
      .then((res) => {
        if (cancelled) return;
        setAgents(res.data);

        // B0: 零 Agent
        if (res.data.length === 0) {
          return;
        }

        // Auto-redirect if no agentId or invalid agentId
        if (agentId) {
          const exists = res.data.some((a) => a.id === agentId);
          if (!exists) {
            // Agent 不存在，标记为已删除并重定向到第一个
            setAgentRemoved(true);
            navigate(`/collaborate/${res.data[0].id}`, { replace: true });
          }
        } else {
          // URL 无 agentId → 自动选第一个（按 updatedAt 降序）
          const sorted = [...res.data].sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
          navigate(`/collaborate/${sorted[0].id}`, { replace: true });
        }
      })
      .catch((err) => {
        console.error('Failed to load agents:', err);
      })
      .finally(() => {
        if (!cancelled) setAgentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load thread history when switching threads
  useEffect(() => {
    if (!agentId || !activeThreadId) return;
    if (lastThreadRef.current === activeThreadId) return;
    lastThreadRef.current = activeThreadId;

    const existing = getMessages(activeThreadId);
    if (existing.length === 0) {
      loadHistory(agentId, activeThreadId);
    }
  }, [agentId, activeThreadId, getMessages, loadHistory]);

  // Process initial message from navigation state
  useEffect(() => {
    if (!agentId) return;

    if (location.state?.initialMessage && !initialMessageProcessed.current) {
      const sendInitialMessage = async () => {
        initialMessageProcessed.current = true;
        let threadId = activeThreadId;

        // 优先使用 Home 页面创建的 threadId
        if (location.state?.threadId) {
          threadId = location.state.threadId;
          // 切换到该 thread（等 threads 加载完后会自动切换）
          switchThread(threadId);
        }

        // 如果没有 threadId，创建新 Thread
        if (!threadId) {
          try {
            const newThread = await createNewThread();
            threadId = newThread.id;
          } catch {
            return;
          }
        }

        sendMessage(agentId, threadId, location.state.initialMessage);
        // 清除 location state 避免重复发送
        window.history.replaceState({}, '');
      };

      sendInitialMessage();
    }
  }, [location.state, agentId, activeThreadId, sendMessage, createNewThread, switchThread]);

  // Scroll to bottom on new messages (debounced to avoid flickering during streaming)
  useEffect(() => {
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
    return () => clearTimeout(timer);
  }, [messages]);

  const handleOpenArtifact = (block: Extract<MessageBlock, { type: 'artifact' }>) => {
    setActiveArtifact(block);
    setRightPanel('canvas');
  };

  const handleAnswerQuestion = useCallback(
    async (id: string, answers: Record<string, string>) => {
      if (!agentId || !activeThreadId) return;
      try {
        await replyToQuestion(agentId, activeThreadId, id, answers);
        // Mark the question as answered in the UI
        updateBlock(activeThreadId, id, { answered: true, answers } as any);
      } catch (err) {
        console.error('Failed to reply to question:', err);
      }
    },
    [agentId, activeThreadId, updateBlock]
  );

  const handleSend = useCallback(
    (content: string) => {
      if (!agentId) return;

      // B1: 有 Agent 但零对话时，发送消息需要先创建 Thread
      if (!activeThreadId) {
        const sendWithNewThread = async () => {
          try {
            const newThread = await createNewThread();
            if (newThread?.id && agentId) {
              sendMessage(agentId, newThread.id, content);
            }
          } catch (err) {
            console.error('Failed to create thread and send message:', err);
          }
        };
        sendWithNewThread();
        return;
      }

      sendMessage(agentId, activeThreadId, content);
    },
    [agentId, activeThreadId, sendMessage, createNewThread]
  );

  const handleCreateThread = useCallback(async () => {
    setThreadLoadError(null);
    try {
      const newThread = await createNewThread();
      if (newThread?.id) {
        // URL 会通过 useEffect 自动更新
        // 新 Thread 显示欢迎界面（通过检查 messages.length === 0）
      }
    } catch (err) {
      console.error('Failed to create thread:', err);
      setThreadLoadError(err instanceof Error ? err.message : 'Failed to create thread');
    }
  }, [createNewThread]);

  const handleSwitchThread = useCallback(
    async (threadId: string) => {
      if (!agentId) return;

      setIsSwitchingThread(true);
      setThreadLoadError(null);

      try {
        // 切换 Thread
        switchThread(threadId);

        // 加载历史消息
        await loadHistory(agentId, threadId);
      } catch (err) {
        console.error('Failed to switch thread:', err);
        setThreadLoadError(err instanceof Error ? err.message : 'Failed to load thread');
      } finally {
        setIsSwitchingThread(false);
      }
    },
    [agentId, switchThread, loadHistory]
  );

  // URL 同步：从 URL 读取 threadId 并同步到状态（仅在组件挂载时执行一次）
  useEffect(() => {
    const urlThreadId = searchParams.get('threadId');

    if (urlThreadId && urlThreadId !== activeThreadId) {
      // URL 有 threadId，切换到该 Thread
      handleSwitchThread(urlThreadId);
    } else if (!urlThreadId && activeThreadId) {
      // URL 没有 threadId 但有 activeThreadId，更新 URL
      setSearchParams({ threadId: activeThreadId });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // URL 同步：当 activeThreadId 变化时更新 URL
  useEffect(() => {
    if (activeThreadId) {
      setSearchParams({ threadId: activeThreadId });
    } else {
      setSearchParams({});
    }
  }, [activeThreadId, setSearchParams]);

  const getStatusColor = () => {
    if (!activeThread) return 'bg-stone-400';
    switch (activeThread.status) {
      case 'running':
        return 'bg-[#4ade80]';
      case 'idle':
        return 'bg-stone-400';
      case 'completed':
        return 'bg-[#4ade80]';
      case 'error':
        return 'bg-red-500';
    }
  };

  const getStatusText = () => {
    if (!activeThread) return 'New';
    switch (activeThread.status) {
      case 'running':
        return 'Working...';
      case 'idle':
        return 'Idle';
      case 'completed':
        return 'Completed';
      case 'error':
        return 'Error';
    }
  };

  const isRightPanelOpen = rightPanel !== 'none';
  const isAgentInactive = activeAgent && !activeAgent.isActive;

  return (
    <div className="flex h-full bg-surface-container-low">
      {/* Left Sidebar — Agent List */}
      <div
        className="h-full bg-surface-container border-r border-surface-container-highest flex flex-col shrink-0 relative"
        style={{ width: sidebarWidth }}
      >
        <div className="p-6 pb-4 border-b border-surface-container-highest">
          <h2 className="text-[12px] font-bold text-stone mb-3 uppercase tracking-widest">
            AI Employees
          </h2>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-stone text-[18px]">
              search
            </span>
            <input
              className="w-full pl-9 pr-3 py-2 bg-surface-container-highest border border-transparent rounded-lg text-sm focus:border-border-cream outline-none focus:bg-ivory transition-all placeholder:text-stone/60"
              placeholder="Search agents..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-grow overflow-y-auto p-3 space-y-1 custom-scrollbar">
          {agentsLoading ? (
            <div className="flex items-center justify-center h-32">
              <span className="text-[11px] text-stone">Loading agents...</span>
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <span className="text-[11px] text-stone">
                {searchQuery ? 'No agents found' : 'No AI Employees yet'}
              </span>
            </div>
          ) : (
            filteredAgents.map((agent) => {
              // 从聚合对象获取 Thread 状态颜色
              const threadStatusColor = agent.threadSummary
                ? agent.threadSummary.latestStatus === 'running'
                  ? 'bg-[#4ade80]'
                  : agent.threadSummary.latestStatus === 'error'
                  ? 'bg-red-500'
                  : 'bg-stone-400'
                : 'bg-transparent';

              return (
                <a
                  key={agent.id}
                  href={`/collaborate/${agent.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(`/collaborate/${agent.id}`);
                  }}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left group border cursor-pointer ${
                    agentId === agent.id
                      ? 'bg-surface-container-highest text-charcoal border-border-cream/50 shadow-sm'
                      : 'hover:bg-surface-container-highest/60 border-transparent text-charcoal'
                  } ${!agent.isActive ? 'opacity-60' : ''}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full bg-ivory flex items-center justify-center shrink-0 shadow-sm border ${
                      agentId === agent.id ? 'border-border-cream/50' : 'border-transparent group-hover:border-border-cream/50'
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined text-[16px] ${
                        agentId === agent.id ? 'text-charcoal' : 'text-stone group-hover:text-charcoal'
                      }`}
                    >
                      {agent.icon || 'smart_toy'}
                    </span>
                  </div>
                  <div className="overflow-hidden flex-1">
                    <div className="flex items-center gap-2">
                      <p
                        className={`text-sm truncate ${agentId === agent.id ? 'font-semibold text-charcoal' : 'text-charcoal'}`}
                      >
                        {agent.name}
                      </p>
                      {!agent.isActive && (
                        <span className="text-[9px] font-semibold text-stone bg-surface-container px-1.5 py-0.5 rounded uppercase shrink-0">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-stone truncate">{agent.description || 'AI Agent'}</p>
                  </div>
                  {/* Thread 状态点 */}
                  {threadStatusColor !== 'bg-transparent' && (
                    <div className={`w-2 h-2 rounded-full ${threadStatusColor} shrink-0`} />
                  )}
                </a>
              );
            })
          )}
        </div>

        <div
          onMouseDown={startResizing}
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-brand/50 z-50 transition-colors -mr-[0.5px]"
        >
          {isResizing && <div className="absolute inset-y-0 w-8 -ml-4" />}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-w-0 bg-surface-container-low relative">
        {/* B0: 零 Agent */}
        {agents.length === 0 && !agentsLoading && <EmptyCollaborateView />}

        {/* 正常内容区域 */}
        {agents.length > 0 && (
          <>
            {/* B2b: Agent 被删除横幅 */}
            {agentRemoved && <AgentRemovedBanner />}

            {/* Header */}
            <header className="absolute top-0 w-full h-16 border-b border-surface-container-highest bg-surface-container-low/80 backdrop-blur-md flex items-center px-8 z-30 justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container">
                    <span className="material-symbols-outlined text-[18px]">
                      {activeAgent?.icon || 'smart_toy'}
                    </span>
                  </div>
                  <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 ${getStatusColor()} border-2 border-surface-container-low rounded-full`} />
                </div>
                <div>
                  <h2 className="text-[16px] font-semibold text-charcoal">
                    {activeAgent?.name || 'Agent Chat'}
                  </h2>
                  <span className="text-[11px] text-stone font-medium">{getStatusText()}</span>
                </div>
              </div>

              {/* ThreadDropdown - 替代原来的 Thread 覆盖面板 */}
              {activeAgent && (
                <ThreadDropdown
                  threads={threads}
                  activeThreadId={activeThreadId}
                  onSwitchThread={handleSwitchThread}
                  onCreateThread={handleCreateThread}
                  loading={threadsLoading}
                />
              )}
            </header>

            {/* B2a: Agent 被停用横幅 */}
            {isAgentInactive && <AgentInactiveBanner />}

            {/* Chat Panel */}
            <section
              className={`${
                rightPanel === 'canvas'
                  ? 'w-[40%] min-w-[360px] max-w-[500px]'
                  : 'flex-1'
              } flex flex-col border-r border-surface-container-highest pt-16 transition-all duration-300 min-h-0 relative overflow-hidden`}
            >
              <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                <div className="p-6 space-y-6 w-full max-w-4xl mx-auto flex flex-col">
                {/* Thread 切换 Loading 状态 */}
                {isSwitchingThread && (
                  <div className="flex items-center justify-center h-full">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-6 h-6 border-2 border-stone/30 border-t-charcoal rounded-full animate-spin" />
                      <span className="text-[12px] text-stone">Loading conversation...</span>
                    </div>
                  </div>
                )}

                {/* Thread 加载错误提示 */}
                {threadLoadError && !isSwitchingThread && (
                  <div className="flex items-center justify-center h-full">
                    <div className="flex flex-col items-center gap-4 text-center max-w-md">
                      <span className="material-symbols-outlined text-[40px] text-red-500">error_outline</span>
                      <div>
                        <p className="text-sm text-charcoal font-medium mb-1">Failed to load conversation</p>
                        <p className="text-xs text-stone">{threadLoadError}</p>
                      </div>
                      <button
                        onClick={() => {
                          setThreadLoadError(null);
                          if (activeThreadId && agentId) {
                            handleSwitchThread(activeThreadId);
                          }
                        }}
                        className="px-4 py-2 bg-brand text-white text-sm font-semibold rounded-lg hover:bg-brand/90 transition-colors"
                      >
                        Retry
                      </button>
                    </div>
                  </div>
                )}

                {!activeAgent ? (
                  <div className="flex items-center justify-center h-full">
                    <span className="text-[12px] text-stone">Select an agent to start chatting</span>
                  </div>
                ) : !isSwitchingThread && !threadLoadError && (
                  // B1: 有 Agent 但零对话
                  activeThreadId && messages.length === 0 && !isStreaming ? (
                    <div className="flex items-center justify-center h-full">
                      <span className="text-[12px] text-stone">No messages yet</span>
                    </div>
                  ) : activeThreadId && messages.length > 0 ? (
                    <>
                      <div className="text-center">
                        <span className="px-3 py-1 rounded-full bg-surface-container text-[11px] font-bold tracking-wider text-stone uppercase">
                          Today
                        </span>
                      </div>
                      {messages.map((message) =>
                        message.role === 'user' ? (
                          <UserMessage key={message.id} message={message} />
                        ) : (
                          <AssistantMessage
                            key={message.id}
                            message={message}
                            agentIcon={activeAgent?.icon || 'smart_toy'}
                            onOpenArtifact={handleOpenArtifact}
                            onAnswerQuestion={handleAnswerQuestion}
                          />
                        )
                      )}
                    </>
                  ) : // B1: Agent 欢迎卡片（新建 Thread 或空 Thread）
                  activeAgent && (!activeThreadId || messages.length === 0) ? (
                    <AgentWelcomeView agent={activeAgent} onSendMessage={handleSend} />
                  ) : null
                )}

                <div ref={messagesEndRef} />
                </div>
              </div>

              {/* FloatingPlanPanel 和 ChatInput */}
              {activeAgent && activeThreadId && (
                <>
                  <FloatingPlanPanel todos={currentPlanTodos} />
                  <ChatInput
                    agentName={activeAgent.name}
                    onSend={handleSend}
                    disabled={
                      isStreaming ||
                      isSwitchingThread ||
                      activeThread?.status === 'running' ||
                      isAgentInactive
                    }
                    placeholder={
                      isSwitchingThread
                        ? 'Loading conversation...'
                        : isAgentInactive
                        ? 'This AI Employee is currently inactive'
                        : activeThread?.status === 'running'
                        ? 'Agent is thinking...'
                        : undefined
                    }
                  />
                </>
              )}

              {/* B1 场景下的 ChatInput（无 activeThreadId 但有 activeAgent） */}
              {activeAgent && !activeThreadId && !isAgentInactive && !isSwitchingThread && (
                <ChatInput
                  agentName={activeAgent.name}
                  onSend={handleSend}
                  disabled={isStreaming}
                />
              )}
            </section>

            {/* Right Panel: Canvas */}
            {rightPanel === 'canvas' && (
              <ArtifactPanel
                block={activeArtifact}
                onClose={() => {
                  setRightPanel('none');
                  setActiveArtifact(null);
                }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
