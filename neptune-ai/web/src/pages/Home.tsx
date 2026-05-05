import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listAgents } from "../api/agents";
import type { AgentTemplate } from "../types/chat";

export function Home() {
  const [isAgentDropdownOpen, setIsAgentDropdownOpen] = useState(false);
  const [agentSearchQuery, setAgentSearchQuery] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [agents, setAgents] = useState<AgentTemplate[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    listAgents({ active: true })
      .then(res => setAgents(res.data))
      .catch(err => console.error('Failed to load agents:', err));
  }, []);

  const agentOptions = agents.map(a => ({
    id: a.id,
    name: a.name,
    description: a.description,
    icon: a.icon,
  }));

  const [selectedAgent, setSelectedAgent] = useState<{ id: string; name: string; description: string | null; icon: string } | null>(null);

  const filteredAgents = agentOptions.filter(a => a.name.toLowerCase().includes(agentSearchQuery.toLowerCase()));

  const handleStartChat = () => {
    if (!selectedAgent) return;
    
    // We can pass the initial message in state so the Collaborate view can process it immediately
    navigate(`/collaborate/${selectedAgent.id}`, { 
      state: { initialMessage: chatInput } 
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      handleStartChat();
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsAgentDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <header className="sticky top-0 h-16 border-b border-surface-container-highest bg-surface/80 backdrop-blur-md flex justify-between items-center px-8 z-40">
        <div className="flex items-center gap-4">
          <span className="text-xl font-bold tracking-tight text-charcoal font-serif">Neptune-AI</span>
        </div>
        <div className="flex items-center gap-4">
          <button className="w-10 h-10 flex items-center justify-center text-stone hover:text-charcoal transition-colors">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <button className="w-10 h-10 flex items-center justify-center text-stone hover:text-charcoal transition-colors">
            <span className="material-symbols-outlined">history</span>
          </button>
          <div className="w-8 h-8 rounded-full overflow-hidden ml-2 border border-surface-container">
            <img alt="User avatar" src="https://ui-avatars.com/api/?name=Alex&background=c96442&color=fff" />
          </div>
        </div>
      </header>

      <main className="flex-1 p-10 flex flex-col items-center">
        <div className="w-full max-w-4xl flex flex-col items-center mt-12">
          {/* Welcome Pill */}
          <div className="bg-secondary-container text-on-secondary-container text-[12px] font-bold px-4 py-2 rounded-full mb-6 flex items-center gap-2 shadow-sm border border-secondary-container/30 uppercase tracking-wide">
            <span className="material-symbols-outlined text-[14px]">waving_hand</span>
            Welcome To Neptune AI
          </div>

          <h1 className="font-serif text-[40px] leading-tight text-charcoal mb-16 text-center">Good Morning, Alex</h1>

          <div className="w-full max-w-2xl bg-surface-lowest border border-surface-container rounded-full p-2 shadow-whisper flex items-center mb-16 focus-within:ring-1 focus-within:ring-border-cream transition-all relative">
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsAgentDropdownOpen(!isAgentDropdownOpen)}
                className="flex items-center gap-2 bg-surface-container hover:bg-surface-container-high px-5 py-3 rounded-full text-charcoal text-sm font-semibold transition-colors border border-transparent min-w-[160px] justify-between"
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-brand">
                    {selectedAgent ? selectedAgent.icon : 'smart_toy'}
                  </span>
                  {selectedAgent ? selectedAgent.name : 'Select Agent'}
                </div>
                <span className="material-symbols-outlined text-[18px] text-stone">keyboard_arrow_down</span>
              </button>

              {isAgentDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-surface-lowest border border-border-cream rounded-xl shadow-md z-50 overflow-hidden flex flex-col">
                  <div className="p-2 border-b border-surface-container px-3 flex items-center gap-2 bg-surface-container-low/50">
                    <span className="material-symbols-outlined text-[18px] text-stone">search</span>
                    <input
                      type="text"
                      className="bg-transparent border-none focus:ring-0 text-sm outline-none w-full"
                      placeholder="Search agents..."
                      value={agentSearchQuery}
                      onChange={(e) => setAgentSearchQuery(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="max-h-60 overflow-y-auto w-full custom-scrollbar py-1">
                    {filteredAgents.length > 0 ? filteredAgents.map(agent => (
                      <button
                        key={agent.id}
                        onClick={() => {
                          setSelectedAgent(agent);
                          setIsAgentDropdownOpen(false);
                        }}
                        className="w-full px-3 py-2 flex items-center gap-3 hover:bg-surface-container transition-colors text-left"
                      >
                        <div className="w-8 h-8 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-[16px]">{agent.icon || 'smart_toy'}</span>
                        </div>
                        <span className="text-sm font-medium text-charcoal">{agent.name}</span>
                      </button>
                    )) : (
                      <div className="px-4 py-3 text-sm text-stone text-center">No agents found</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <input 
              className="flex-1 bg-transparent border-none focus:ring-0 text-[18px] px-6 text-charcoal placeholder:text-stone outline-none w-full" 
              placeholder="How can I help you?" 
              type="text" 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button 
              onClick={handleStartChat}
              disabled={!selectedAgent || !chatInput.trim()}
              className="w-12 h-12 rounded-full bg-primary-container text-white flex items-center justify-center hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity shadow-sm shrink-0 mr-1"
            >
              <span className="material-symbols-outlined">arrow_upward</span>
            </button>
          </div>

          <div className="w-full max-w-3xl mt-8">
            <h2 className="text-[12px] font-bold text-stone mb-6 pl-2 tracking-widest uppercase">Active Agents</h2>

            <div className="flex flex-col gap-4">
              {agents.length === 0 ? (
                <div className="text-center py-8">
                  <span className="text-[12px] text-stone">No agents available</span>
                </div>
              ) : (
                agents.slice(0, 5).map(agent => (
                  <Link key={agent.id} to={`/collaborate/${agent.id}`} className="group flex items-center justify-between p-5 bg-surface-lowest border border-surface-container-highest rounded-xl shadow-whisper hover:border-border-cream transition-all cursor-pointer">
                    <div className="flex items-center gap-5">
                      <div className="w-12 h-12 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center">
                        <span className="material-symbols-outlined">{agent.icon || 'smart_toy'}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="font-serif text-[18px] font-medium text-charcoal mb-1">{agent.name}</span>
                        <div className="flex items-center gap-2 text-sm text-stone">
                          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                          <span>{agent.description || 'AI Agent'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-stone group-hover:text-charcoal group-hover:bg-surface-container transition-all">
                      <span className="material-symbols-outlined">chevron_right</span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
