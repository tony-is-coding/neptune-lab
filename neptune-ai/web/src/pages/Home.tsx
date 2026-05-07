import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listAgents } from "../api/agents";
import { createThread } from "../api/threads";
import type { AgentTemplate } from "../types/chat";

export function Home() {
  const [isAgentDropdownOpen, setIsAgentDropdownOpen] = useState(false);
  const [agentSearchQuery, setAgentSearchQuery] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [agents, setAgents] = useState<AgentTemplate[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setAttachedFiles(prev => [...prev, ...Array.from(files)]);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleStartChat = async () => {
    if (!selectedAgent || !chatInput.trim()) return;

    setIsSubmitting(true);
    try {
      // Create a thread first, then navigate to collaborate with the thread
      const thread = await createThread(selectedAgent.id, chatInput.trim().slice(0, 50));
      navigate(`/collaborate/${selectedAgent.id}`, {
        state: {
          initialMessage: chatInput,
          threadId: thread.id,
          attachedFiles: attachedFiles.map(f => f.name),
        }
      });
    } catch (err) {
      console.error('Failed to create thread:', err);
      // Fallback: navigate without thread creation
      navigate(`/collaborate/${selectedAgent.id}`, {
        state: { initialMessage: chatInput }
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
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
        <div className="w-[80%] flex flex-col items-center mt-12">
          {/* Welcome Pill */}
          <div className="bg-secondary-container text-on-secondary-container text-[11px] font-bold px-3.5 py-1.5 rounded-full mb-5 flex items-center gap-1.5 shadow-sm border border-secondary-container/30 uppercase tracking-wide">
            <span className="material-symbols-outlined text-[13px]">waving_hand</span>
            Welcome To Neptune AI
          </div>

          <h1 className="font-serif text-[32px] leading-tight text-charcoal mb-12 text-center">Good Morning, Alex</h1>

          <div className="w-full bg-surface-lowest border border-surface-container rounded-2xl p-2.5 shadow-whisper flex flex-col mb-12 focus-within:ring-1 focus-within:ring-border-cream transition-all relative">
            {/* Textarea */}
            <textarea
              className="w-full bg-transparent border-none focus:ring-0 text-[14px] px-3 py-2 text-charcoal placeholder:text-stone/60 outline-none resize-none leading-relaxed"
              placeholder="Select an agent to start a new collaboration"
              rows={3}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />

            {/* Attached files preview */}
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 px-3 pb-1">
                {attachedFiles.map((file, index) => (
                  <div key={index} className="flex items-center gap-1 bg-surface-container rounded-md px-2 py-1 text-[11px] text-charcoal">
                    <span className="material-symbols-outlined text-[12px] text-stone">description</span>
                    <span className="max-w-[100px] truncate">{file.name}</span>
                    <button onClick={() => removeFile(index)} className="text-stone hover:text-charcoal transition-colors">
                      <span className="material-symbols-outlined text-[12px]">close</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Bottom action bar: agent selector + attach + send */}
            <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-surface-container-highest">
              <div className="flex items-center gap-0.5">
                {/* Agent selector dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setIsAgentDropdownOpen(!isAgentDropdownOpen)}
                    className="flex items-center gap-1.5 bg-surface-container hover:bg-surface-container-high px-3 py-1.5 rounded-lg text-charcoal text-[13px] font-medium transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px] text-brand">
                      {selectedAgent ? selectedAgent.icon : 'smart_toy'}
                    </span>
                    {selectedAgent ? selectedAgent.name : 'Select Agent'}
                    <span className="material-symbols-outlined text-[14px] text-stone">keyboard_arrow_down</span>
                  </button>

                  {isAgentDropdownOpen && (
                    <div className="absolute bottom-full left-0 mb-1.5 w-56 bg-surface-lowest border border-border-cream rounded-xl shadow-md z-50 overflow-hidden flex flex-col">
                      <div className="p-2 border-b border-surface-container flex items-center gap-2">
                        <span className="material-symbols-outlined text-[14px] text-stone">search</span>
                        <input
                          type="text"
                          className="bg-transparent border-none focus:ring-0 text-[12px] outline-none w-full"
                          placeholder="Search agents..."
                          value={agentSearchQuery}
                          onChange={(e) => setAgentSearchQuery(e.target.value)}
                          autoFocus
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto w-full custom-scrollbar py-0.5">
                        {filteredAgents.length > 0 ? filteredAgents.map(agent => (
                          <button
                            key={agent.id}
                            onClick={() => {
                              setSelectedAgent(agent);
                              setIsAgentDropdownOpen(false);
                            }}
                            className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-surface-container transition-colors text-left"
                          >
                            <span className="material-symbols-outlined text-[16px] text-stone">{agent.icon || 'smart_toy'}</span>
                            <span className="text-[13px] text-charcoal">{agent.name}</span>
                          </button>
                        )) : (
                          <div className="px-4 py-2 text-[12px] text-stone text-center">No agents found</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* File upload */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 text-stone hover:text-charcoal hover:bg-surface-container rounded-lg transition-colors"
                  title="Attach files"
                >
                  <span className="material-symbols-outlined text-[18px]">attach_file</span>
                </button>
              </div>

              {/* Send button */}
              <button
                onClick={handleStartChat}
                disabled={!selectedAgent || !chatInput.trim() || isSubmitting}
                className="w-8 h-8 rounded-lg bg-primary-container text-white flex items-center justify-center hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm shrink-0"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
                )}
              </button>
            </div>
          </div>

          <div className="w-full mt-6">
            <h2 className="text-[11px] font-bold text-stone mb-4 pl-1 tracking-widest uppercase">Active Agents</h2>

            <div className="flex flex-col gap-3">
              {agents.length === 0 ? (
                <div className="text-center py-6">
                  <span className="text-[11px] text-stone">No agents available</span>
                </div>
              ) : (
                agents.slice(0, 5).map(agent => (
                  <Link key={agent.id} to={`/collaborate/${agent.id}`} className="group flex items-center justify-between p-3.5 bg-surface-lowest border border-surface-container-highest rounded-xl shadow-whisper hover:border-border-cream transition-all cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center">
                        <span className="material-symbols-outlined text-[18px]">{agent.icon || 'smart_toy'}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="font-serif text-[15px] font-medium text-charcoal">{agent.name}</span>
                        <div className="flex items-center gap-1.5 text-[12px] text-stone">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                          <span>{agent.description || 'AI Agent'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-stone group-hover:text-charcoal group-hover:bg-surface-container transition-all">
                      <span className="material-symbols-outlined text-[16px]">chevron_right</span>
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
