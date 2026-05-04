import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuthStore } from '../stores/auth';
import type { AgentTemplate } from '../types';

export function AgentList() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [agents, setAgents] = useState<AgentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<AgentTemplate | null>(null);
  const [showAgentDropdown, setShowAgentDropdown] = useState(false);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getAgents(true);
      setAgents(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const filteredAgents = searchQuery
    ? agents.filter((a) => a.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : agents;

  const handleSend = () => {
    if (!searchQuery.trim()) return;
    if (selectedAgent) {
      navigate(`/agent/${selectedAgent.id}`);
    } else if (filteredAgents.length > 0) {
      navigate(`/agent/${filteredAgents[0].id}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        {/* TopAppBar skeleton */}
        <div className="h-16 shrink-0 border-b border-np-border-lighter" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-np-text-muted">Loading agents...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col">
        <div className="h-16 shrink-0 border-b border-np-border-lighter" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-np-red">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* TopAppBar — 64px per Figma */}
      <div className="h-16 shrink-0 backdrop-blur-[6px] bg-[rgba(255,255,255,0.8)] border-b border-np-border-lighter flex items-center justify-between px-8">
        <div className="flex flex-col justify-center">
          <span className="text-[20px] font-extrabold text-np-primary leading-[28px]">Neptune-AI</span>
        </div>
        <div className="flex items-center gap-4">
          <button className="flex items-center justify-center w-10 h-10 rounded-full opacity-80 hover:opacity-100 transition-opacity">
            <svg className="w-4 h-5 text-np-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M13.73 21a2 2 0 01-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button className="flex items-center justify-center w-10 h-10 rounded-full opacity-80 hover:opacity-100 transition-opacity">
            <svg className="w-[18px] h-[18px] text-np-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </button>
          <div className="w-8 h-8 rounded-full border border-np-border-lighter overflow-hidden">
            <div className="w-full h-full bg-np-accent flex items-center justify-center">
              <span className="text-[10px] font-semibold text-np-primary">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-[896px] mx-auto px-6 pt-[56px] pb-20">
          {/* Welcome Banner — per Figma: bg-[#f2e0c8] pill */}
          <div className="mb-6">
            <div className="bg-np-accent border border-[rgba(213,196,173,0.3)] shadow-[0px_1px_1px_rgba(0,0,0,0.05)] inline-flex items-center gap-2 px-[17px] py-[9px] rounded-full">
              <svg className="w-[13px] h-[13px] text-np-text" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z" />
              </svg>
              <span className="text-[12px] font-bold text-np-text tracking-[0.6px]">Welcome To Neptune AI</span>
            </div>
          </div>

          {/* Greeting — per Figma: 40px bold, tracking -0.8px */}
          <div className="mb-16">
            <h1 className="text-[40px] font-bold text-np-text tracking-[-0.8px] text-center leading-[48px]">
              {getGreeting()}, {user?.name?.split(' ')[0] || 'User'}
            </h1>
          </div>

          {/* Input Bar — per Figma: rounded-full pill with Select Agent dropdown + input + send button */}
          <div className="mb-16">
            <div className="bg-np-ivory border border-np-border shadow-[0px_4px_10px_rgba(45,41,38,0.04)] rounded-full flex items-center p-[9px] max-w-[672px] w-full mx-auto">
              {/* Select Agent Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowAgentDropdown(!showAgentDropdown)}
                  className="bg-np-sidebar rounded-full flex items-center gap-2 px-[21px] py-[13px] hover:bg-np-border-lighter transition-colors"
                >
                  {selectedAgent ? (
                    <div className="w-[18px] h-[15px] bg-np-accent rounded-full flex items-center justify-center">
                      <span className="text-[7px] font-bold text-np-primary">{selectedAgent.name.charAt(0)}</span>
                    </div>
                  ) : (
                    <svg className="w-[18px] h-[15px] text-np-text" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M12 2C6.48 2 2 6 2 11c0 2.76 1.36 5.22 3.48 6.84L4 22l4.92-2.16C10.16 20.28 11.06 20.5 12 20.5c5.52 0 10-4 10-9S17.52 2 12 2z" />
                    </svg>
                  )}
                  <span className="text-[16px] text-np-text text-center w-[98px]">
                    {selectedAgent ? selectedAgent.name : 'Select Agent'}
                  </span>
                  <svg className="w-[9px] h-[6px] text-np-text" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M1 1l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {/* Dropdown */}
                {showAgentDropdown && (
                  <div className="absolute top-full left-0 mt-2 bg-white border border-np-border rounded-xl shadow-[0px_4px_10px_rgba(45,41,38,0.08)] py-2 min-w-[200px] z-50">
                    {agents.map((agent) => (
                      <button
                        key={agent.id}
                        onClick={() => {
                          setSelectedAgent(agent);
                          setShowAgentDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-np-bg-warm transition-colors flex items-center gap-3 ${
                          selectedAgent?.id === agent.id ? 'bg-[rgba(242,224,200,0.5)]' : ''
                        }`}
                      >
                        <div className="w-7 h-7 rounded-full bg-np-accent flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-semibold text-np-primary">
                            {agent.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-np-text">{agent.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Input Field */}
              <div className="flex-1 min-w-0 px-6 py-2.5">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="How can I help you?"
                  className="w-full bg-transparent text-[18px] text-np-text placeholder:text-np-text-secondary focus:outline-none"
                />
              </div>

              {/* Send Button — 48px circle per Figma */}
              <button
                onClick={handleSend}
                className="bg-np-primary rounded-full w-12 h-12 flex items-center justify-center shadow-[0px_1px_1px_rgba(0,0,0,0.05)] hover:opacity-90 transition-opacity shrink-0"
              >
                <svg className="w-4 h-4 text-white" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M0 14l8-14 8 14-8-4.5L0 14z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Active Agents Section */}
          <div className="max-w-[768px] mx-auto">
            <div className="flex flex-col gap-6">
              {/* Section Label */}
              <div className="pl-2">
                <span className="text-[12px] font-bold text-np-text-secondary tracking-[1.2px]">ACTIVE AGENTS</span>
              </div>

              {/* Agent Cards */}
              {filteredAgents.length === 0 ? (
                <div className="text-center py-20">
                  <div className="bg-np-sidebar w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <svg className="w-8 h-8 text-np-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M12 2C6.48 2 2 6 2 11c0 2.76 1.36 5.22 3.48 6.84L4 22l4.92-2.16C10.16 20.28 11.06 20.5 12 20.5c5.52 0 10-4 10-9S17.52 2 12 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-np-text mb-2">
                    {searchQuery ? 'No results found' : 'No agents yet'}
                  </h3>
                  <p className="text-sm text-np-text-secondary mb-6 max-w-[320px] mx-auto">
                    {searchQuery
                      ? 'Try adjusting your search terms or browse all agents'
                      : 'Create your first AI agent to get started. Agents help automate tasks and workflows.'}
                  </p>
                  {!searchQuery && (
                    <button
                      onClick={() => navigate('/agents/create')}
                      className="inline-flex items-center gap-2 bg-np-primary text-white px-6 py-3 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      Create Agent
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {filteredAgents.map((agent) => (
                    <div
                      key={agent.id}
                      onClick={() => navigate(`/agent/${agent.id}`)}
                      className="bg-np-ivory border border-np-border drop-shadow-[0px_2px_4px_rgba(45,41,38,0.04)] flex items-center justify-between p-[21px] rounded-[12px] cursor-pointer hover:shadow-[0px_4px_10px_rgba(45,41,38,0.08)] transition-shadow"
                    >
                      <div className="flex items-center gap-5">
                        {/* Agent Icon — 48px circle per Figma */}
                        <div className="w-12 h-12 rounded-full bg-np-accent flex items-center justify-center shrink-0">
                          <span className="text-[14px] font-semibold text-np-primary">
                            {agent.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        {/* Agent Info */}
                        <div className="flex flex-col gap-0">
                          <span className="text-[18px] font-normal text-np-text leading-[25px]">{agent.name}</span>
                          <div className="flex items-center gap-2">
                            {/* Green status dot — 8px per Figma */}
                            <div className={`w-2 h-2 rounded-full ${agent.isActive ? 'bg-np-online' : 'bg-np-text-muted'}`} />
                            <span className="text-[14px] text-np-text-secondary leading-[21px]">
                              {agent.isActive
                                ? 'Active — Ready to assist'
                                : agent.description || 'Idle'}
                            </span>
                          </div>
                        </div>
                      </div>
                      {/* Right chevron — 32px circle per Figma */}
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0">
                        <svg className="w-[7.4px] h-3 text-np-text-muted" viewBox="0 0 10 12" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M1 1l6 5-6 5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
