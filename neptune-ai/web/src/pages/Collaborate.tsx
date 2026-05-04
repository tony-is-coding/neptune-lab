import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useResizableSidebar } from '../hooks/useResizableSidebar';
import { useChatMessages } from '../hooks/useChatMessages';
import { useThreads } from '../hooks/useThreads';
import { UserMessage } from '../components/chat/UserMessage';
import { AssistantMessage } from '../components/chat/AssistantMessage';
import { ChatInput } from '../components/chat/ChatInput';
import { ArtifactPanel } from '../components/artifact/ArtifactPanel';
import { TaskBar } from '../components/task/TaskBar';
import { ThreadList } from '../components/thread/ThreadList';
import type { MessageBlock } from '../types/chat';

type RightPanel = 'none' | 'canvas';

export function Collaborate() {
  const { agentId } = useParams<{ agentId: string }>();
  const location = useLocation();

  const { sidebarWidth, isResizing, startResizing } = useResizableSidebar(240, 200, 400);

  // Thread management
  const {
    threads,
    activeThreadId,
    activeThread,
    loading: threadsLoading,
    createNewThread,
    switchThread,
    loadThreads,
  } = useThreads(agentId || '');

  // Chat messages — keyed by threadId
  const { getMessages, getPlanTasks, getBackgroundTasks, sendMessage, loadHistory, isStreaming } = useChatMessages();

  const activeThreadMessages = getMessages(activeThreadId || '');
  const planTasks = getPlanTasks(activeThreadId || '');
  const backgroundTasks = getBackgroundTasks(activeThreadId || '');

  const initialMessageProcessed = useRef(false);
  const lastThreadRef = useRef<string | null>(null);

  const [rightPanel, setRightPanel] = useState<RightPanel>('none');
  const [activeArtifact, setActiveArtifact] = useState<Extract<MessageBlock, { type: 'artifact' }> | null>(null);
  const [threadsOpen, setThreadsOpen] = useState(true);

  // When switching threads, load history
  useEffect(() => {
    if (!agentId || !activeThreadId) return;
    if (lastThreadRef.current === activeThreadId) return;
    lastThreadRef.current = activeThreadId;

    // Only load history if we don't have messages for this thread yet
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

  const handleOpenArtifact = (block: Extract<MessageBlock, { type: 'artifact' }>) => {
    setActiveArtifact(block);
    setRightPanel('canvas');
  };

  const openPanel = (panel: RightPanel) => {
    if (rightPanel === panel) {
      setRightPanel('none');
    } else {
      setRightPanel(panel);
    }
  };

  const isRightPanelOpen = rightPanel !== 'none';

  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeThreadMessages]);

  const handleCreateThread = useCallback(async () => {
    await createNewThread();
  }, [createNewThread]);

  const handleSend = useCallback((content: string) => {
    if (!agentId || !activeThreadId) return;
    sendMessage(agentId, activeThreadId, content);
  }, [agentId, activeThreadId, sendMessage]);

  // Thread status indicator for the header
  const getStatusColor = () => {
    if (!activeThread) return 'bg-stone-400';
    switch (activeThread.status) {
      case 'running': return 'bg-green-500';
      case 'idle': return 'bg-stone-400';
      case 'completed': return 'bg-green-500';
      case 'error': return 'bg-red-500';
    }
  };

  return (
    <div className="flex h-full bg-surface-container-low">
      {/* Secondary Drawer / Thread Sidebar */}
      <div
        className="h-full bg-surface-container border-r border-surface-container-highest flex flex-col shrink-0 relative"
        style={{ width: sidebarWidth }}
      >
        <div className="p-6 pb-4 border-b border-surface-container-highest">
          <h2 className="text-[12px] font-bold text-stone mb-3 uppercase tracking-widest">Threads</h2>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-stone text-[18px]">search</span>
            <input className="w-full pl-9 pr-3 py-2 bg-surface-container-highest border border-transparent rounded-lg text-sm focus:border-border-cream outline-none focus:bg-ivory transition-all placeholder:text-stone/60" placeholder="Search threads..." type="text" />
          </div>
        </div>

        <div className="flex-grow overflow-hidden">
          {threadsLoading && threads.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <span className="text-[11px] text-stone">Loading threads...</span>
            </div>
          ) : (
            <ThreadList
              threads={threads}
              activeThreadId={activeThreadId}
              onSwitch={switchThread}
              onCreateNew={handleCreateThread}
            />
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
                <span className="material-symbols-outlined text-[18px]">smart_toy</span>
              </div>
              <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 ${getStatusColor()} border-2 border-surface-container-low rounded-full`} />
            </div>
            <div>
              <h2 className="text-[16px] font-semibold text-charcoal">
                {activeThread?.title || 'Agent Chat'}
              </h2>
              <span className="text-[11px] text-stone font-medium">
                {activeThread?.status === 'running' ? 'Working...' :
                 activeThread?.status === 'idle' ? 'Idle' :
                 activeThread?.status === 'error' ? 'Error' :
                 activeThread?.status === 'completed' ? 'Completed' :
                 'Select a thread'}
              </span>
            </div>
          </div>
        </header>

        {/* Chat Panel */}
        <section className={`${rightPanel === 'canvas' ? 'w-[40%] min-w-[360px] max-w-[500px]' : 'flex-1'} flex flex-col border-r border-surface-container-highest pt-16 transition-all duration-300 items-center min-h-0 relative`}>
          {/* Threads overlay — left side */}
          {threadsOpen && (
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
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <ThreadList
                  threads={threads}
                  activeThreadId={activeThreadId}
                  onSwitch={switchThread}
                  onCreateNew={handleCreateThread}
                />
              </div>
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 space-y-6 w-full max-w-4xl flex flex-col">
            <div className="text-center">
              <span className="px-3 py-1 rounded-full bg-surface-container text-[11px] font-bold tracking-wider text-stone uppercase">Today</span>
            </div>

            {!activeThreadId ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-[13px] text-stone">Select a thread or create a new one</p>
                  <p className="text-[11px] text-stone/60 mt-1">Threads organize your conversations with this agent</p>
                </div>
              </div>
            ) : (
              activeThreadMessages.map((message) => (
                message.role === 'user' ? (
                  <UserMessage key={message.id} message={message} />
                ) : (
                  <AssistantMessage
                    key={message.id}
                    message={message}
                    agentIcon="smart_toy"
                    onOpenArtifact={handleOpenArtifact}
                  />
                )
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <TaskBar planTasks={planTasks} />

          <ChatInput
            agentName={activeThread?.title || 'Agent'}
            onSend={handleSend}
            disabled={isStreaming || !activeThreadId}
          />
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
