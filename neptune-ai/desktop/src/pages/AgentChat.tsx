import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuthStore } from '../stores/auth';
import type { AgentTemplate } from '../types';

interface MessageWithRole {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isTyping?: boolean;
  tools?: Array<{
    name: string;
    input?: Record<string, unknown>;
    output?: Record<string, unknown>;
    status?: 'running' | 'completed' | 'error';
  }>;
  suggestions?: string[];
}

function UserMessage({ content, initial }: { content: string; initial?: string }) {
  return (
    <div className="flex justify-end pt-10">
      <div className="flex gap-3 max-w-[324px]">
        <div className="px-6 py-3 rounded-2xl rounded-tr-sm text-sm leading-[21px] whitespace-pre-wrap break-words text-np-text">
          {content}
        </div>
        <div className="bg-np-dark flex items-center justify-center w-7 h-7 rounded-full shrink-0">
          <span className="text-white text-xs font-bold">{initial || 'U'}</span>
        </div>
      </div>
    </div>
  );
}

function AssistantMessage({
  content,
  isTyping,
  tools,
  agentInitial,
  suggestions,
  onSuggestionClick,
}: {
  content: string;
  isTyping?: boolean;
  tools?: MessageWithRole['tools'];
  agentInitial?: string;
  suggestions?: string[];
  onSuggestionClick?: (text: string) => void;
}) {
  return (
    <div className="flex justify-start pt-10">
      <div className="flex gap-3 max-w-[342px]">
        <div className="pt-1">
          <div className="bg-np-accent flex items-center justify-center w-7 h-7 rounded-full shrink-0">
            <span className="text-np-primary text-xs font-bold">{agentInitial || 'A'}</span>
          </div>
        </div>
        <div className="bg-white/0 border border-np-border-light shadow-[0px_1px_1px_rgba(0,0,0,0.05)] rounded-2xl rounded-tl-sm px-6 py-3 space-y-3">
          {/* Tool calls */}
          {tools && tools.map((tool, idx) => (
            <div key={tool.name + idx} className="bg-[rgba(230,225,224,0.3)] border border-[rgba(207,196,189,0.1)] rounded-xl p-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-np-text">
                {tool.status === 'running' ? (
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                ) : tool.status === 'error' ? (
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                ) : (
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                )}
                {tool.name}
              </div>
            </div>
          ))}

          {/* Content */}
          {content && (
            <p className="text-sm text-np-text leading-[21px] whitespace-pre-wrap">{content}</p>
          )}

          {/* Typing indicator */}
          {isTyping && !content && (
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 bg-np-text-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 bg-np-text-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 bg-np-text-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          )}

          {/* Suggested actions — pill buttons per Figma */}
          {suggestions && suggestions.length > 0 && !isTyping && (
            <div className="flex flex-col gap-3 pt-1">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => onSuggestionClick?.(suggestion)}
                  className="bg-[rgba(230,225,224,0.5)] border border-[rgba(207,196,189,0.2)] rounded-full px-[13px] py-[7px] text-xs font-semibold text-np-text hover:bg-[rgba(230,225,224,0.8)] transition-colors w-fit"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AgentChat() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);

  const [agent, setAgent] = useState<AgentTemplate | null>(null);
  const [agents, setAgents] = useState<AgentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<MessageWithRole[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!agentId) return;
    loadAgent();
    loadHistory();
    loadAgents();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [agentId]);

  const loadAgent = async () => {
    if (!agentId) return;
    try {
      setLoading(true);
      const data = await apiClient.getAgent(agentId);
      setAgent(data);
    } catch {
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    if (!agentId) return;
    try {
      const response = await apiClient.getChatHistory(agentId, 50);
      const historyMessages: MessageWithRole[] = response.data.map((msg, idx) => ({
        id: `history-${idx}`,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.timestamp).getTime(),
      }));
      setMessages(historyMessages);
    } catch {
      // History loading is non-critical
    }
  };

  const loadAgents = async () => {
    try {
      const response = await apiClient.getAgents(true);
      setAgents(response.data);
    } catch {
      // Non-critical
    }
  };

  const handleSuggestionClick = (text: string) => {
    setInput(text);
  };

  const handleSend = async (overrideInput?: string) => {
    const textToSend = overrideInput || input;
    if (!textToSend.trim() || !agentId || !token || isConnected) return;

    const userMessage: MessageWithRole = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const userInput = textToSend.trim();
    setInput('');

    const assistantMessageId = `assistant-${Date.now()}`;
    setMessages((prev) => [...prev, {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isTyping: true,
    }]);

    setIsConnected(true);
    setError(null);
    abortControllerRef.current = new AbortController();

    try {
      const chatURL = apiClient.getChatURL(agentId);
      const response = await fetch(chatURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ content: userInput }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No reader available');

      let buffer = '';
      let currentContent = '';
      const tools: MessageWithRole['tools'] = [];

      while (true) {
        if (abortControllerRef.current?.signal.aborted) break;
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let eventType = '';
        let eventData = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            eventData = line.slice(6).trim();

            if (eventType && eventData) {
              try {
                const data = JSON.parse(eventData);

                if (eventType === 'message') {
                  if (data.type === 'text') {
                    currentContent += data.content || '';
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === assistantMessageId
                          ? { ...msg, content: currentContent, isTyping: true }
                          : msg
                      )
                    );
                  } else if (data.type === 'tool_use') {
                    tools.push({
                      name: data.name || 'unknown',
                      input: data.input,
                      status: 'running',
                    });
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === assistantMessageId
                          ? { ...msg, tools: [...tools] }
                          : msg
                      )
                    );
                  } else if (data.type === 'tool_result') {
                    const lastTool = tools[tools.length - 1];
                    if (lastTool) {
                      lastTool.output = data.output;
                      lastTool.status = data.error ? 'error' : 'completed';
                    }
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === assistantMessageId
                          ? { ...msg, tools: [...tools] }
                          : msg
                      )
                    );
                  }
                } else if (eventType === 'done') {
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? {
                            ...msg,
                            isTyping: false,
                            suggestions: currentContent
                              ? ['Use Benchmarks', 'I have specific figures']
                              : undefined,
                          }
                        : msg
                    )
                  );
                  setIsConnected(false);
                } else if (eventType === 'error') {
                  setError((data as { error: string }).error);
                  setIsConnected(false);
                }

                eventType = '';
                eventData = '';
              } catch {
                // Ignore parse errors
              }
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, isTyping: false }
              : msg
          )
        );
      }
      setIsConnected(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-np-text-muted">Loading agent...</div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-np-red">Agent not found</div>
      </div>
    );
  }

  const agentInitial = agent.name.charAt(0).toUpperCase();
  const userInitial = user?.name?.charAt(0)?.toUpperCase() || 'U';

  return (
    <div className="flex h-full">
      {/* Secondary Drawer — 208px per Figma */}
      <div className="w-[240px] bg-np-sidebar flex flex-col shrink-0 border-r border-np-border-light">
        {/* Title + Search */}
        <div className="border-b border-np-border-light px-6 pt-6 pb-3 space-y-2">
          <h2 className="text-[12px] font-bold text-np-text-secondary tracking-[0.6px] uppercase">Collaborate</h2>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-[13.5px] h-[13.5px] text-[rgba(77,69,64,0.5)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search agents..."
              className="w-full bg-np-border-light rounded-lg py-2 pl-8 pr-3 text-sm text-[rgba(77,69,64,0.5)] focus:outline-none"
            />
          </div>
        </div>

        {/* Recent Agents list */}
        <div className="flex-1 overflow-y-auto px-3 pt-6 space-y-1">
          <p className="text-[12px] font-bold text-[rgba(77,69,64,0.7)] tracking-[0.6px] px-3 py-2 uppercase">Recent Agents</p>
          {agents.map((a) => (
            <Link
              key={a.id}
              to={`/agent/${a.id}`}
              className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                a.id === agentId
                  ? 'bg-[rgba(242,224,200,0.5)]'
                  : 'hover:bg-[rgba(242,224,200,0.3)]'
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                a.id === agentId
                  ? 'bg-white shadow-[0px_1px_1px_rgba(0,0,0,0.05)]'
                  : 'bg-white'
              }`}>
                <span className="text-[10px] font-semibold text-np-primary">
                  {a.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-[14px] truncate ${
                  a.id === agentId
                    ? 'font-semibold text-np-text-accent'
                    : 'font-normal text-np-text'
                }`}>
                  {a.name}
                </p>
                <p className="text-[12px] text-np-text-secondary truncate">
                  {a.isActive ? 'Active' : 'Idle'}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Chat Thread (Left Pane — 360px per Figma) */}
      <div className="flex flex-col h-full w-[360px] min-w-[360px] max-w-[500px]">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Time divider */}
          <div className="flex items-center justify-center mb-4">
            <div className="bg-np-sidebar px-3 py-1 rounded-full">
              <span className="text-[12px] font-semibold text-np-text-secondary tracking-[0.6px] uppercase">
                Today, {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
              </span>
            </div>
          </div>

          {/* Welcome */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-np-text-muted">
              <div className="bg-np-accent flex items-center justify-center w-12 h-12 rounded-full mb-4">
                <span className="text-np-primary text-lg font-bold">{agentInitial}</span>
              </div>
              <p className="text-sm font-medium">Start a conversation with {agent.name}</p>
              <p className="text-xs mt-1">Type a message below</p>
            </div>
          )}

          {/* Message list */}
          {messages.map((msg) =>
            msg.role === 'user' ? (
              <UserMessage key={msg.id} content={msg.content} initial={userInitial} />
            ) : (
              <AssistantMessage
                key={msg.id}
                content={msg.content}
                isTyping={msg.isTyping}
                tools={msg.tools}
                agentInitial={agentInitial}
                suggestions={msg.suggestions}
                onSuggestionClick={handleSuggestionClick}
              />
            )
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mt-4">
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input Area — per Figma */}
        <div className="p-6 space-y-2">
          <div className="bg-white border border-[rgba(230,225,224,0.5)] shadow-[0px_1px_1px_rgba(0,0,0,0.05)] flex items-end gap-3 p-[9px] rounded-2xl">
            {/* Attach button */}
            <button className="p-1.5 rounded-full hover:bg-[rgba(230,225,224,0.3)] transition-colors shrink-0 mb-0.5">
              <svg className="w-[10px] h-[17px] text-np-text-muted" viewBox="0 0 14 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M7 18V2M3 14l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {/* Text area */}
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={`Message ${agent.name}...`}
              disabled={isConnected}
              className="flex-1 bg-transparent text-sm text-np-text placeholder:text-[rgba(77,69,64,0.5)] focus:outline-none resize-none disabled:opacity-50 min-h-[40px] max-h-[120px] py-2"
              rows={1}
            />

            {/* Send button — 32px rounded-[12px] per Figma */}
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isConnected}
              className="bg-np-dark rounded-xl w-8 h-8 flex items-center justify-center hover:opacity-80 transition-opacity disabled:opacity-30 shrink-0 mb-0.5"
            >
              <svg className="w-3.5 h-3 text-white" viewBox="0 0 14 12" fill="currentColor">
                <path d="M0 12l7-12 7 12-7-3.5L0 12z" />
              </svg>
            </button>
          </div>

          <p className="text-[10px] text-[rgba(77,69,64,0.7)] text-center">
            Content generated by AI, please verify
          </p>
        </div>
      </div>

      {/* Canvas Area (Right Pane — per Figma) */}
      <div className="flex-1 flex flex-col h-full bg-white">
        {/* Canvas Toolbar — 56px per Figma */}
        <div className="backdrop-blur-[2px] bg-[rgba(255,255,255,0.9)] border-b border-np-border-light flex items-center justify-between px-6 h-14 shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-np-accent flex items-center justify-center w-[18px] h-[18px] rounded-sm">
              <svg className="w-2.5 h-2.5 text-np-primary" viewBox="0 0 10 10" fill="currentColor">
                <rect width="10" height="10" rx="1" />
              </svg>
            </div>
            <span className="text-[16px] font-semibold text-np-text">{agent.name} Output</span>
          </div>
          <div className="flex items-center gap-3">
            <button className="bg-np-border-warm border border-[rgba(207,196,189,0.3)] rounded-lg flex items-center gap-2 px-[17px] py-1 text-sm font-semibold text-np-text hover:bg-[#e0ddd0] transition-colors h-8">
              <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M5 1l4 4-4 4M1 5h7" strokeLinecap="round" />
              </svg>
              Export
            </button>
            <div className="w-px h-5 bg-np-border-light" />
            <button className="p-1.5 rounded-lg hover:bg-np-sidebar transition-colors">
              <svg className="w-3 h-3 text-np-text-secondary" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="6" cy="6" r="5" />
                <path d="M6 4v4M4 6h4" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Canvas Content — Bento Grid + Table + Chart per Figma */}
        <div className="flex-1 bg-[rgba(247,243,241,0.3)] p-6 overflow-auto">
          <div className="bg-white border border-np-border-light shadow-[0px_1px_1px_rgba(0,0,0,0.05)] min-h-full rounded-2xl p-10">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-96 text-np-text-muted">
                <svg className="w-16 h-16 mb-4 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18M9 21V9" />
                </svg>
                <p className="text-sm">Start a conversation to see agent output</p>
              </div>
            ) : (
              <CanvasContent agentName={agent.name} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CanvasContent({ agentName }: { agentName: string }) {
  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-[30px] font-semibold text-np-text tracking-[-0.3px]">
          {agentName} Analysis
        </h2>
        <p className="text-[16px] text-np-text-secondary leading-[26px] mt-4">
          Interactive output from your conversation with {agentName}. The canvas displays data artifacts, charts, and analysis results.
        </p>
      </div>

      {/* Bento Grid — 3 KPI cards per Figma */}
      <div className="grid grid-cols-3 gap-6 mt-12">
        <KPICard
          label="EST. TOTAL MRR"
          sublabel="(END Q3)"
          value="$2.4M"
          change="+12.4% vs Q2"
          positive
        />
        <KPICard
          label="AVG REVENUE"
          sublabel="PER USER"
          value="$142"
          change="+$18 post-adjustment"
          positive
        />
        <KPICard
          label="PROJECTED"
          sublabel="CHURN"
          value="4.2%"
          change="Peak in August"
          positive={false}
        />
      </div>

      {/* Monthly Breakdown Table */}
      <div className="mt-10">
        <h3 className="text-[18px] font-semibold text-np-text mb-4">Monthly Breakdown</h3>
        <div className="border border-np-border-light rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-np-border-light">
                <th className="text-left px-6 py-3 text-[12px] font-semibold text-np-text-secondary tracking-[0.6px] uppercase">Month</th>
                <th className="text-left px-6 py-3 text-[12px] font-semibold text-np-text-secondary tracking-[0.6px] uppercase">Base Active Users</th>
                <th className="text-left px-6 py-3 text-[12px] font-semibold text-np-text-secondary tracking-[0.6px] uppercase">New MRR</th>
                <th className="text-left px-6 py-3 text-[12px] font-semibold text-np-text-secondary tracking-[0.6px] uppercase">Churned MRR</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-np-border-light">
                <td className="px-6 py-3 text-[14px] font-medium text-np-text">July</td>
                <td className="px-6 py-3 text-[14px] text-np-text-secondary">14,200</td>
                <td className="px-6 py-3 text-[14px] font-medium text-np-green">+$85,000</td>
                <td className="px-6 py-3 text-[14px] font-medium text-np-red">-$22,000</td>
              </tr>
              <tr className="border-b border-np-border-light bg-[rgba(242,224,200,0.1)]">
                <td className="px-6 py-3 text-[14px] font-medium text-np-text">
                  <div className="flex items-center gap-2">
                    August
                    <span className="bg-np-dark text-white text-[10px] font-bold px-2 py-0.5 rounded tracking-[0.5px] uppercase leading-[15px]">Price Hike</span>
                  </div>
                </td>
                <td className="px-6 py-3 text-[14px] text-np-text-secondary">14,550</td>
                <td className="px-6 py-3 text-[14px] font-medium text-np-green">+$110,000</td>
                <td className="px-6 py-3 text-[14px] font-medium text-np-red">-$45,000</td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-[14px] font-medium text-np-text">September</td>
                <td className="px-6 py-3 text-[14px] text-np-text-secondary">14,800</td>
                <td className="px-6 py-3 text-[14px] font-medium text-np-green">+$95,000</td>
                <td className="px-6 py-3 text-[14px] font-medium text-np-red">-$28,000</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Chart Placeholder */}
      <div className="mt-10 border border-np-border-light rounded-2xl p-6 bg-gradient-to-br from-white to-np-sidebar">
        <h3 className="text-[18px] font-semibold text-np-text mb-8">MRR Growth Trajectory</h3>
        <div className="flex items-end gap-6 h-[150px]">
          <div className="flex-1 bg-[rgba(24,21,18,0.2)] rounded-t-lg h-[45%]" />
          <div className="flex-1 bg-[rgba(105,93,74,0.4)] rounded-t-lg h-[55%]" />
          <div className="flex-1 bg-np-dark shadow-[0px_0px_10px_rgba(45,41,38,0.1)] rounded-t-lg h-full" />
        </div>
        <div className="flex gap-6 mt-2">
          <div className="flex-1 text-center text-[12px] font-semibold text-np-text">Jul</div>
          <div className="flex-1 text-center text-[12px] font-semibold text-np-text">Aug</div>
          <div className="flex-1 text-center text-[12px] font-semibold text-np-text">Sep</div>
        </div>
      </div>
    </div>
  );
}

function KPICard({
  label,
  sublabel,
  value,
  change,
  positive,
}: {
  label: string;
  sublabel: string;
  value: string;
  change: string;
  positive: boolean;
}) {
  return (
    <div className="bg-np-sidebar border border-np-border-light rounded-xl p-6 space-y-1">
      <div className="text-[12px] font-semibold text-np-text-secondary tracking-[0.6px] uppercase">
        {label}<br />{sublabel}
      </div>
      <div className="text-[24px] font-semibold text-np-text leading-[33.6px]">{value}</div>
      <div className="flex items-center gap-1">
        <svg className={`w-3 h-[7px] ${positive ? 'text-np-green' : 'text-np-red'}`} viewBox="0 0 12 7" fill="currentColor">
          {positive
            ? <path d="M6 0L12 7H0z" />
            : <path d="M6 7L0 0h12z" />
          }
        </svg>
        <span className={`text-[12px] font-semibold ${positive ? 'text-np-green' : 'text-np-red'}`}>
          {change}
        </span>
      </div>
    </div>
  );
}
