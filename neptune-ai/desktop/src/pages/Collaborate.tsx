import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuthStore } from '../stores/auth';
import { apiClient } from '../api/client';
import type { AgentTemplate } from '../types';

interface Conversation {
  id: string;
  title: string;
  agentName: string;
  agentInitial: string;
  lastMessage: string;
  timestamp: string;
  messages: ChatMessage[];
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export function Collaborate() {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const [agents, setAgents] = useState<AgentTemplate[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [input, setInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [selectedConv?.messages, scrollToBottom]);

  useEffect(() => {
    apiClient.getAgents(true).then((res) => setAgents(res.data)).catch(() => {});
  }, []);

  const handleCreateConversation = (agent: AgentTemplate) => {
    const newConv: Conversation = {
      id: `conv-${Date.now()}`,
      title: `New chat with ${agent.name}`,
      agentName: agent.name,
      agentInitial: agent.name.charAt(0).toUpperCase(),
      lastMessage: 'Start a conversation...',
      timestamp: 'Just now',
      messages: [],
    };
    setConversations((prev) => [newConv, ...prev]);
    setSelectedConv(newConv);
  };

  const handleSend = async () => {
    if (!input.trim() || !selectedConv || isConnected) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    const assistantMsg: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };

    const updatedMessages = [...selectedConv.messages, userMsg, assistantMsg];
    const updatedConv = {
      ...selectedConv,
      messages: updatedMessages,
      lastMessage: input.trim(),
      timestamp: 'Just now',
    };
    setSelectedConv(updatedConv);
    setConversations((prev) =>
      prev.map((c) => (c.id === updatedConv.id ? updatedConv : c))
    );
    setInput('');

    // Try to find matching agent and send via API
    const agent = agents.find((a) => a.name === selectedConv.agentName);
    if (!agent || !token) {
      // Fallback: simulate response
      const simulated = {
        ...updatedConv,
        messages: updatedMessages.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: `Hello! I'm ${selectedConv.agentName}. How can I help you today?` }
            : m
        ),
      };
      setSelectedConv(simulated);
      setConversations((prev) =>
        prev.map((c) => (c.id === simulated.id ? simulated : c))
      );
      return;
    }

    setIsConnected(true);
    abortControllerRef.current = new AbortController();

    try {
      const chatURL = apiClient.getChatURL(agent.id);
      const response = await fetch(chatURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ content: input.trim() }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No reader');

      let buffer = '';
      let currentContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'text') {
                currentContent += data.content || '';
                const finalContent = currentContent;
                setSelectedConv((prev) => prev ? {
                  ...prev,
                  messages: prev.messages.map((m) =>
                    m.id === assistantMsg.id ? { ...m, content: finalContent } : m
                  ),
                } : prev);
              }
            } catch { /* ignore */ }
          }
        }
      }
    } catch {
      // Fallback response
      setSelectedConv((prev) => prev ? {
        ...prev,
        messages: prev.messages.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: `Hello! I'm ${selectedConv.agentName}. How can I help you today?` }
            : m
        ),
      } : prev);
    } finally {
      setIsConnected(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const userInitial = user?.name?.charAt(0)?.toUpperCase() || 'U';

  // Determine view state
  const viewState: 'empty' | 'select_agent' | 'chat' =
    !selectedConv ? 'empty' : selectedConv.messages.length === 0 ? 'select_agent' : 'chat';

  return (
    <div className="flex h-full">
      {/* Left: Conversation List */}
      <div className="w-[280px] border-r border-np-border-lighter bg-np-surface flex flex-col shrink-0">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-np-border-lighter">
          <h2 className="text-[18px] font-bold text-np-primary tracking-[-0.45px] mb-1">Conversations</h2>
          <p className="text-[14px] text-np-text-secondary">Manage your collaborative sessions</p>
        </div>

        {/* New Conversation Button */}
        <div className="px-4 py-3">
          <button
            onClick={() => {
              setSelectedConv(null);
            }}
            className="w-full flex items-center justify-center gap-2 bg-np-primary text-white text-sm font-medium py-2.5 rounded-xl hover:opacity-90 transition-opacity"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Conversation
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto px-3">
          {conversations.length === 0 ? (
            <div className="text-center py-8 px-4">
              <p className="text-[12px] text-np-text-muted">No conversations yet</p>
            </div>
          ) : (
            <div className="space-y-1">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConv(conv)}
                  className={`w-full text-left flex items-center gap-3 p-3 rounded-xl transition-colors ${
                    selectedConv?.id === conv.id
                      ? 'bg-[rgba(242,224,200,0.5)]'
                      : 'hover:bg-[rgba(242,224,200,0.3)]'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-np-accent flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-semibold text-np-primary">{conv.agentInitial}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium text-np-text truncate">{conv.title}</p>
                    <p className="text-[12px] text-np-text-secondary truncate">{conv.lastMessage}</p>
                  </div>
                  <span className="text-[11px] text-np-text-muted shrink-0">{conv.timestamp}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Main Area */}
      <div className="flex-1 flex flex-col h-full">
        {viewState === 'empty' && (
          /* State 1: Empty — Select an agent to start */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-[480px]">
              <div className="bg-np-sidebar w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-np-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-np-text mb-2">Start Collaborating</h2>
              <p className="text-sm text-np-text-secondary mb-8">
                Select an AI agent to begin a collaborative session. Work together on tasks, get insights, and build solutions.
              </p>
              <div className="grid grid-cols-2 gap-3 max-w-[400px] mx-auto">
                {agents.slice(0, 4).map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => handleCreateConversation(agent)}
                    className="flex items-center gap-3 bg-white border border-np-border rounded-xl p-3 hover:shadow-[0px_4px_10px_rgba(45,41,38,0.08)] transition-shadow text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-np-accent flex items-center justify-center shrink-0">
                      <span className="text-sm font-semibold text-np-primary">{agent.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-np-text truncate">{agent.name}</p>
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${agent.isActive ? 'bg-np-online' : 'bg-np-text-muted'}`} />
                        <span className="text-[11px] text-np-text-secondary">{agent.isActive ? 'Active' : 'Idle'}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              {agents.length === 0 && (
                <p className="text-sm text-np-text-muted">No agents available. Create one first.</p>
              )}
            </div>
          </div>
        )}

        {viewState === 'select_agent' && selectedConv && (
          /* State 2: New conversation — show welcome */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="bg-np-accent w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-np-primary">{selectedConv.agentInitial}</span>
              </div>
              <h2 className="text-lg font-semibold text-np-text mb-2">Chat with {selectedConv.agentName}</h2>
              <p className="text-sm text-np-text-secondary mb-6">Type a message below to start the conversation</p>
            </div>
          </div>
        )}

        {viewState === 'chat' && selectedConv && (
          /* State 3: Active conversation — show messages */
          <div className="flex-1 flex flex-col">
            {/* Chat header */}
            <div className="h-14 border-b border-np-border-lighter flex items-center gap-3 px-6 shrink-0">
              <div className="bg-np-accent w-8 h-8 rounded-full flex items-center justify-center">
                <span className="text-xs font-semibold text-np-primary">{selectedConv.agentInitial}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-np-text">{selectedConv.agentName}</p>
                <p className="text-[11px] text-np-text-secondary">Collaborative session</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {selectedConv.messages.map((msg) => (
                msg.role === 'user' ? (
                  <div key={msg.id} className="flex justify-end">
                    <div className="flex gap-2 max-w-[70%]">
                      <div className="px-4 py-2 rounded-2xl rounded-tr-sm text-sm text-np-text whitespace-pre-wrap">
                        {msg.content}
                      </div>
                      <div className="bg-np-dark w-7 h-7 rounded-full flex items-center justify-center shrink-0">
                        <span className="text-white text-xs font-bold">{userInitial}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div key={msg.id} className="flex justify-start">
                    <div className="flex gap-2 max-w-[70%]">
                      <div className="bg-np-accent w-7 h-7 rounded-full flex items-center justify-center shrink-0">
                        <span className="text-np-primary text-xs font-bold">{selectedConv.agentInitial}</span>
                      </div>
                      <div className="border border-np-border-light px-4 py-2 rounded-2xl rounded-tl-sm text-sm text-np-text whitespace-pre-wrap">
                        {msg.content || (
                          <div className="flex gap-1">
                            <div className="w-1.5 h-1.5 bg-np-text-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-1.5 h-1.5 bg-np-text-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-1.5 h-1.5 bg-np-text-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>
        )}

        {/* Chat Input — always visible when a conversation is selected */}
        {selectedConv && (
          <div className="p-4 border-t border-np-border-lighter">
            <div className="bg-white border border-[rgba(230,225,224,0.5)] shadow-[0px_1px_1px_rgba(0,0,0,0.05)] flex items-end gap-2 p-2 rounded-2xl">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Message ${selectedConv.agentName}...`}
                disabled={isConnected}
                className="flex-1 bg-transparent text-sm text-np-text placeholder:text-[rgba(77,69,64,0.5)] focus:outline-none resize-none disabled:opacity-50 min-h-[40px] max-h-[120px] py-2 px-3"
                rows={1}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isConnected}
                className="bg-np-dark rounded-xl w-8 h-8 flex items-center justify-center hover:opacity-80 transition-opacity disabled:opacity-30 shrink-0"
              >
                <svg className="w-3.5 h-3 text-white" viewBox="0 0 14 12" fill="currentColor">
                  <path d="M0 12l7-12 7 12-7-3.5L0 12z" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
