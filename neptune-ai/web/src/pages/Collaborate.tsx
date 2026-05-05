import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useResizableSidebar } from '../hooks/useResizableSidebar';
import { useChatMessages } from '../hooks/useChatMessages';
import { useThreads } from '../hooks/useThreads';
import { listAgents } from '../api/agents';
import { UserMessage } from '../components/chat/UserMessage';
import { AssistantMessage } from '../components/chat/AssistantMessage';
import { ChatInput } from '../components/chat/ChatInput';
import { ArtifactPanel } from '../components/artifact/ArtifactPanel';
import { TaskBar } from '../components/task/TaskBar';
import { ThreadItem } from '../components/thread/ThreadItem';
import type { AgentTemplate, MessageBlock } from '../types/chat';

type RightPanel = 'none' | 'canvas';

export function Collaborate() {
  const { agentId } = useParams<{ agentId: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  // Agent list (left sidebar)
  const [agents, setAgents] = useState<AgentTemplate[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const { sidebarWidth, isResizing, startResizing } = useResizableSidebar(240, 200, 400);

  // Active agent
  const activeAgent = agents.find(a => a.id === agentId) || null;

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
  const { getMessages, getPlanTasks, sendMessage, loadHistory, isStreaming } = useChatMessages();
  const messages = getMessages(activeThreadId || '');
  const planTasks = getPlanTasks(activeThreadId || '');

  // UI state
  const [rightPanel, setRightPanel] = useState<RightPanel>('none');
  const [activeArtifact, setActiveArtifact] = useState<Extract<MessageBlock, { type: 'artifact' }> | null>(null);
  const [threadsOpen, setThreadsOpen] = useState(true);

  const initialMessageProcessed = useRef(false);
  const lastThreadRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load agents on mount
  useEffect(() => {
    let cancelled = false;
    setAgentsLoading(true);
    listAgents({ active: true })
      .then(res => {
        if (cancelled) return;
        setAgents(res.data);
        // Auto-redirect if no agentId or invalid agentId
        if (res.data.length > 0) {
          const validId = res.data.some(a => a.id === agentId);
          if (!validId) {
            navigate(`/collaborate/${res.data[0].id}`, { replace: true });
          }
        }
      })
      .catch(err => {
        console.error('Failed to load agents:', err);
      })
      .finally(() => {
        if (!cancelled) setAgentsLoading(false);
      });
    return () => { cancelled = true; };
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
    if (!agentId || !activeThreadId) return;
    if (location.state?.initialMessage && !initialMessageProcessed.current) {
      initialMessageProcessed.current = true;
      sendMessage(agentId, activeThreadId, location.state.initialMessage);
    }
  }, [location.state, agentId, activeThreadId, sendMessage]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleOpenArtifact = (block: Extract<MessageBlock, { type: 'artifact' }>) => {
    setActiveArtifact(block);
    setRightPanel('canvas');
  };

  const handleSend = useCallback((content: string) => {
    if (!agentId || !activeThreadId) return;
    sendMessage(agentId, activeThreadId, content);
  }, [agentId, activeThreadId, sendMessage]);

  const handleCreateThread = useCallback(async () => {
    await createNewThread();
  }, [createNewThread]);

  const getStatusColor = () => {
    if (!activeThread) return 'bg-stone-400';
    switch (activeThread.status) {
      case 'running': return 'bg-[#4ade80]';
      case 'idle': return 'bg-stone-400';
      case 'completed': return 'bg-[#4ade80]';
      case 'error': return 'bg-red-500';
    }
  };

  const getStatusText = () => {
    if (!activeThread) return 'Select a thread';
    switch (activeThread.status) {
      case 'running': return 'Working...';
      case 'idle': return 'Idle';
      case 'completed': return 'Completed';
      case 'error': return 'Error';
    }
  };

  const isRightPanelOpen = rightPanel !== 'none';

  return (
    <div className="flex h-full bg-surface-container-low">
      {/* Left Sidebar — Agent List */}
      <div
        className="h-full bg-surface-container border-r border-surface-container-highest flex flex-col shrink-0 relative"
        style={{ width: sidebarWidth }}
      >
        <div className="p-6 pb-4 border-b border-surface-container-highest">
          <h2 className="text-[12px] font-bold text-stone mb-3 uppercase tracking-widest">Active Agents</h2>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-stone text-[18px]">search</span>
            <input className="w-full pl-9 pr-3 py-2 bg-surface-container-highest border border-transparent rounded-lg text-sm focus:border-border-cream outline-none focus:bg-ivory transition-all placeholder:text-stone/60" placeholder="Search agents..." type="text" />
          </div>
        </div>

        <div className="flex-grow overflow-y-auto p-3 space-y-1 custom-scrollbar">
          {agentsLoading ? (
            <div className="flex items-center justify-center h-32">
              <span className="text-[11px] text-stone">Loading agents...</span>
            </div>
          ) : agents.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <span className="text-[11px] text-stone">No agents found</span>
            </div>
          ) : (
            agents.map(agent => (
              <a
                key={agent.id}
                href={`/collaborate/${agent.id}`}
                onClick={(e) => { e.preventDefault(); navigate(`/collaborate/${agent.id}`); }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left group border cursor-pointer ${agentId === agent.id ? 'bg-surface-container-highest text-charcoal border-border-cream/50 shadow-sm' : 'hover:bg-surface-container-highest/60 border-transparent text-charcoal'}`}
              >
                <div className={`w-8 h-8 rounded-full bg-ivory flex items-center justify-center shrink-0 shadow-sm border ${agentId === agent.id ? 'border-border-cream/50' : 'border-transparent group-hover:border-border-cream/50'}`}>
                  <span className={`material-symbols-outlined text-[16px] ${agentId === agent.id ? 'text-charcoal' : 'text-stone group-hover:text-charcoal'}`}>{agent.icon || 'smart_toy'}</span>
                </div>
                <div className="overflow-hidden">
                  <p className={`text-sm truncate ${agentId === agent.id ? 'font-semibold text-charcoal' : 'text-charcoal'}`}>{agent.name}</p>
                  <p className="text-[11px] text-stone truncate">{agent.description || 'AI Agent'}</p>
                </div>
              </a>
            ))
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
        {/* Header */}
        <header className="absolute top-0 w-full h-16 border-b border-surface-container-highest bg-surface-container-low/80 backdrop-blur-md flex items-center px-8 z-30 justify-between">
          <div className="flex items-center gap-4">
            {!threadsOpen && (
              <button
                onClick={() => setThreadsOpen(true)}
                className="p-1.5 rounded-lg text-stone hover:text-charcoal hover:bg-surface-container/80 transition-colors"
                title="Open threads"
              >
                <span className="material-symbols-outlined text-[20px]">menu</span>
              </button>
            )}
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container">
                <span className="material-symbols-outlined text-[18px]">{activeAgent?.icon || 'smart_toy'}</span>
              </div>
              <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 ${getStatusColor()} border-2 border-surface-container-low rounded-full`} />
            </div>
            <div>
              <h2 className="text-[16px] font-semibold text-charcoal">
                {activeAgent?.name || 'Agent Chat'}
              </h2>
              <span className="text-[11px] text-stone font-medium">
                {getStatusText()}
              </span>
            </div>
          </div>
        </header>

        {/* Chat Panel */}
        <section className={`${rightPanel === 'canvas' ? 'w-[40%] min-w-[360px] max-w-[500px]' : 'flex-1'} flex flex-col border-r border-surface-container-highest pt-16 transition-all duration-300 items-center min-h-0 relative`}>
          {/* Threads overlay — left side */}
          {threadsOpen && activeAgent && (
            <div className="absolute top-16 left-0 bottom-0 w-[280px] z-20 flex flex-col bg-surface-container-low/90 backdrop-blur-md border-r border-surface-container-highest shadow-sm">
              <div className="px-4 py-3 border-b border-surface-container-highest flex items-center justify-between">
                <span className="text-[13px] font-semibold text-charcoal">Threads</span>
                <button
                  onClick={() => setThreadsOpen(false)}
                  className="p-1 rounded-lg text-stone hover:text-charcoal hover:bg-surface-container/80 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
                {threadsLoading && threads.length === 0 ? (
                  <div className="text-center py-8">
                    <span className="text-[11px] text-stone">Loading threads...</span>
                  </div>
                ) : threads.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-[11px] text-stone">No threads yet</p>
                    <p className="text-[10px] text-stone/60 mt-1">Send a message to start</p>
                  </div>
                ) : (
                  threads.map(thread => (
                    <ThreadItem
                      key={thread.id}
                      thread={thread}
                      isActive={thread.id === activeThreadId}
                      onClick={() => switchThread(thread.id)}
                    />
                  ))
                )}
              </div>
              <div className="p-3 border-t border-surface-container-highest">
                <button
                  onClick={handleCreateThread}
                  className="w-full py-2 rounded-lg text-[11px] font-medium text-stone hover:text-charcoal hover:bg-surface-container-highest/60 transition-colors flex items-center justify-center gap-1"
                >
                  <span className="material-symbols-outlined text-[14px]">add</span>
                  New Thread
                </button>
              </div>
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 space-y-6 w-full max-w-4xl flex flex-col">
            {!activeAgent ? (
              <div className="flex items-center justify-center h-full">
                <span className="text-[12px] text-stone">Select an agent to start chatting</span>
              </div>
            ) : !activeThreadId ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <span className="material-symbols-outlined text-[32px] text-stone mb-2 block">chat</span>
                  <span className="text-[12px] text-stone">Start a new conversation</span>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <span className="text-[12px] text-stone">No messages yet</span>
              </div>
            ) : (
              <>
                <div className="text-center">
                  <span className="px-3 py-1 rounded-full bg-surface-container text-[11px] font-bold tracking-wider text-stone uppercase">Today</span>
                </div>
                {messages.map((message) => (
                  message.role === 'user' ? (
                    <UserMessage key={message.id} message={message} />
                  ) : (
                    <AssistantMessage
                      key={message.id}
                      message={message}
                      agentIcon={activeAgent?.icon || 'smart_toy'}
                      onOpenArtifact={handleOpenArtifact}
                    />
                  )
                ))}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>

          {activeAgent && activeThreadId && (
            <>
              <TaskBar planTasks={planTasks} />
              <ChatInput
                agentName={activeAgent.name}
                onSend={handleSend}
                disabled={isStreaming || activeThread?.status === 'running'}
              />
            </>
          )}
        </section>

        {/* Right Panel: Canvas */}
        {rightPanel === 'canvas' && (
          <ArtifactPanel
            block={activeArtifact}
            onClose={() => { setRightPanel('none'); setActiveArtifact(null); }}
          />
        )}
      </div>
    </div>
  );
}
