import { useState, useEffect, useRef } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { useResizableSidebar } from '../hooks/useResizableSidebar';
import { useChatMessages } from '../hooks/useChatMessages';
import { UserMessage } from '../components/chat/UserMessage';
import { AssistantMessage } from '../components/chat/AssistantMessage';
import { ChatInput } from '../components/chat/ChatInput';
import { ArtifactPanel } from '../components/artifact/ArtifactPanel';
import { TaskBar } from '../components/task/TaskBar';
import type { Agent, MessageBlock } from '../types/chat';

const MOCK_AGENTS: Agent[] = [
  { id: 'finance-q3', agentName: 'Financial Architect', agentRole: 'Expert in financial modeling & forecasting', title: 'Q3 Revenue Modeling', time: '2m ago', icon: 'account_balance' },
  { id: 'data-analyst', agentName: 'Data Analyst', agentRole: 'Expert in data visualization and analytics', title: 'User Churn Analysis', time: '1h ago', icon: 'monitoring' },
  { id: 'content-draft', agentName: 'Content Strategist', agentRole: 'Expert in technical documentation', title: 'Product Specs Draft', time: 'Yesterday', icon: 'edit_document' },
  { id: 'backend-refactor', agentName: 'Backend Engineer', agentRole: 'Expert in Node.js and systems architecture', title: 'API Route Refactor', time: 'Yesterday', icon: 'code' },
  { id: 'invoice-processor', agentName: 'Invoice Processor', agentRole: 'Expert in data extraction and OCR', title: 'Vendor Invoice processing', time: '10m ago', icon: 'receipt_long' },
  { id: '1', agentName: 'Customer Support', agentRole: 'Tier 1 Technical Support Representative', title: 'New Support Query', time: 'Just now', icon: 'support_agent' },
  { id: '2', agentName: 'Sales Assistant', agentRole: 'Inbound Sales Representative', title: 'New Sales Inquiry', time: 'Just now', icon: 'shopping_cart' },
  { id: '3', agentName: 'DevOps Copilot', agentRole: 'Internal Infrastructure Support', title: 'New Infrastructure Question', time: 'Just now', icon: 'terminal' },
];

type RightPanel = 'none' | 'canvas';

export function Collaborate() {
  const { id } = useParams();
  const location = useLocation();

  const activeAgentId = id || MOCK_AGENTS[0].id;
  const activeAgent = MOCK_AGENTS.find(c => c.id === activeAgentId) || MOCK_AGENTS[0];
  const { sidebarWidth, isResizing, startResizing } = useResizableSidebar(240, 200, 400);

  const { getMessages, getPlanTasks, getBackgroundTasks, sendMessage, addInitialMessages, isStreaming } = useChatMessages();
  const messages = getMessages(activeAgentId);
  const planTasks = getPlanTasks(activeAgentId);
  const backgroundTasks = getBackgroundTasks(activeAgentId);

  const initialMessageProcessed = useRef(false);
  const lastAgentRef = useRef<string>(activeAgentId);

  const [rightPanel, setRightPanel] = useState<RightPanel>('none');
  const [activeArtifact, setActiveArtifact] = useState<Extract<MessageBlock, { type: 'artifact' }> | null>(null);
  const [threadsOpen, setThreadsOpen] = useState(true);

  // Initialize with mock history when switching agents
  useEffect(() => {
    if (lastAgentRef.current !== activeAgentId) {
      initialMessageProcessed.current = false;
      lastAgentRef.current = activeAgentId;
    }

    addInitialMessages(activeAgentId, [
      {
        id: `history-user-${activeAgentId}`,
        role: 'user',
        blocks: [{ type: 'text', content: `I need to work on ${activeAgent.title.toLowerCase()}. Can we start by outlining the main assumptions?` }],
        status: 'complete',
      },
      {
        id: `history-agent-${activeAgentId}`,
        role: 'assistant',
        blocks: [
          {
            type: 'text',
            content: "Certainly. To build a robust model, we should establish these core assumptions based on your historical data. I've generated a preliminary artifact on the canvas.",
          },
        ],
        status: 'complete',
      },
    ]);
  }, [activeAgentId, activeAgent.title, addInitialMessages]);

  // Process initial message from navigation state
  useEffect(() => {
    if (location.state?.initialMessage && !initialMessageProcessed.current) {
      initialMessageProcessed.current = true;
      sendMessage(activeAgentId, location.state.initialMessage);
    }
  }, [location.state, activeAgentId, sendMessage]);

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
  }, [messages]);

  return (
    <div className="flex h-full bg-surface-container-low">
      {/* Secondary Drawer / Collab Sidebar */}
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
          {MOCK_AGENTS.map(agent => (
            <Link
              key={agent.id}
              to={`/collaborate/${agent.id}`}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left group border ${activeAgentId === agent.id ? 'bg-surface-container-highest text-charcoal border-border-cream/50 shadow-sm' : 'hover:bg-surface-container-highest/60 border-transparent text-charcoal'}`}
            >
              <div className={`w-8 h-8 rounded-full bg-ivory flex items-center justify-center shrink-0 shadow-sm border ${activeAgentId === agent.id ? 'border-border-cream/50' : 'border-transparent group-hover:border-border-cream/50'}`}>
                <span className={`material-symbols-outlined text-[16px] ${activeAgentId === agent.id ? 'text-charcoal' : 'text-stone group-hover:text-charcoal'}`}>{agent.icon}</span>
              </div>
              <div className="overflow-hidden">
                <p className={`text-sm truncate ${activeAgentId === agent.id ? 'font-semibold text-charcoal' : 'text-charcoal'}`}>{agent.agentName}</p>
                <p className="text-[11px] text-stone truncate">{agent.agentRole}</p>
              </div>
            </Link>
          ))}
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
                <span className="material-symbols-outlined text-[18px]">{activeAgent.icon}</span>
              </div>
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#4ade80] border-2 border-surface-container-low rounded-full" />
            </div>
            <div>
              <h2 className="text-[16px] font-semibold text-charcoal">{activeAgent.agentName}</h2>
              <span className="text-[11px] text-stone font-medium">{activeAgent.agentRole}</span>
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
              <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
                <div>
                  <h3 className="text-[9px] font-bold text-stone uppercase tracking-widest mb-2">Main Task</h3>
                  <div className="p-3 bg-brand/5 border border-brand/20 rounded-lg shadow-sm">
                    <div className="text-[10px] font-semibold text-brand mb-0.5">Active dialogue thread</div>
                    <div className="text-[10px] text-stone">Working on {activeAgent.title.toLowerCase()}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 space-y-6 w-full max-w-4xl flex flex-col">
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
                  agentIcon={activeAgent.icon}
                  onOpenArtifact={handleOpenArtifact}
                />
              )
            ))}
            <div ref={messagesEndRef} />
          </div>

          <TaskBar planTasks={planTasks} />

          <ChatInput
            agentName={activeAgent.agentName}
            onSend={(content) => sendMessage(activeAgentId, content)}
            disabled={isStreaming}
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
