import { useState, useRef, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useResizableSidebar } from '../hooks/useResizableSidebar';

const MOCK_AGENTS = [
  { id: "customer-support", name: "Customer Support", status: "Active • Tier 1", icon: "support_agent" },
  { id: "sales-assistant", name: "Sales Assistant", status: "Active • Inbound", icon: "shopping_cart" },
  { id: "devops-copilot", name: "DevOps Copilot", status: "Offline • Internal", icon: "code" }
];

export function AgentConfig() {
  const { id } = useParams();
  
  const activeAgentId = id || MOCK_AGENTS[0].id;
  const activeAgent = MOCK_AGENTS.find(a => a.id === activeAgentId) || MOCK_AGENTS[0];

  const { sidebarWidth, isResizing, startResizing } = useResizableSidebar(240, 200, 400);

  const [isEditingCore, setIsEditingCore] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    name: activeAgent.name,
    description: "Expert agent configured for this role.",
    status: activeAgent.status
  });

  const [coreConfig, setCoreConfig] = useState({
    model: "GPT-4 Optimized (neptune-v2)",
    role: "Tier 1 Technical Support Representative",
    systemPrompt: "You are an empathetic, efficient, and highly technical support agent for Neptune AI. Your primary goal is to resolve user issues regarding workspace configuration, agent deployment, and billing. Always verify the user's workspace ID before providing account-specific details. Maintain a professional yet approachable tone. If an issue requires escalation, use the `escalate_ticket` skill immediately."
  });

  const [memories, setMemories] = useState([
    { id: 1, name: "knowledge_base_v3.pdf", type: "PDF Document", date: "Oct 24, 2023", icon: "description" },
    { id: 2, name: "product_catalog_export.csv", type: "Data Table", date: "Oct 20, 2023", icon: "csv" },
    { id: 3, name: "troubleshooting_guide.md", type: "Markdown", date: "Oct 15, 2023", icon: "article" },
  ]);

  const [knowledge, setKnowledge] = useState([
    { id: 1, name: "product_manual_v2.pdf", type: "PDF Document", size: "2.4 MB", date: "Nov 10, 2023", icon: "picture_as_pdf", color: "text-rose-500" },
    { id: 2, name: "technical_spec.docx", type: "Word Document", size: "1.1 MB", date: "Oct 28, 2023", icon: "description", color: "text-blue-500" },
    { id: 3, name: "customer_faqs.xlsx", type: "Excel Spreadsheet", size: "842 KB", date: "Oct 15, 2023", icon: "table_chart", color: "text-emerald-500" },
    { id: 4, name: "api_documentation.md", type: "Markdown", size: "156 KB", date: "Oct 12, 2023", icon: "markdown", color: "text-stone" },
  ]);

  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteInputText, setDeleteInputText] = useState("");
  const [expectedDeleteCode, setExpectedDeleteCode] = useState("");

  const handleDeleteClick = () => {
    setExpectedDeleteCode(Math.random().toString(36).substring(2, 6).toUpperCase());
    setDeleteInputText("");
    setIsDeleting(true);
  };

  const confirmDelete = () => {
    if (deleteInputText === expectedDeleteCode) {
      alert("Agent deleted (mock)");
      setIsDeleting(false);
    }
  };

  const [skills, setSkills] = useState([
    { id: 1, name: "Zendesk Integration", desc: "Read/Write ticket access", icon: "headset_mic" },
    { id: 2, name: "Stripe Refunds", desc: "Process limited refunds", icon: "payments" },
  ]);

  // Reset local state when active agent changes to simulate loading new agent data
  useEffect(() => {
    setIsEditingCore(false);
    setIsEditingProfile(false);
    
    // You could also re-seed memories/knowledge/skills here based on activeAgentId
    // to give the illusion that different agents have different data.
    if (activeAgentId === "sales-assistant") {
      setCoreConfig({
        model: "GPT-4 Sales (neptune-v2)",
        role: "Inbound Sales Representative",
        systemPrompt: "You are a sales assistant helping prospect customers. Answer questions about pricing and pitch the Enterprise plan if they have more than 10 users."
      });
      setProfileData({
        name: MOCK_AGENTS.find(a => a.id === "sales-assistant")?.name || "Sales Assistant",
        description: "Handles inbound sales inquiries and lead qualification.",
        status: "Active • Inbound"
      });
      setSkills([{ id: 3, name: "CRM Sync", desc: "Syncs leads to Salesforce", icon: "sync" }]);
    } else {
      setCoreConfig({
        model: "GPT-4 Optimized (neptune-v2)",
        role: "Tier 1 Technical Support Representative",
        systemPrompt: "You are an empathetic, efficient, and highly technical support agent for Neptune AI. Your primary goal is to resolve user issues regarding workspace configuration, agent deployment, and billing. Always verify the user's workspace ID before providing account-specific details. Maintain a professional yet approachable tone. If an issue requires escalation, use the `escalate_ticket` skill immediately."
      });
      setProfileData({
        name: activeAgent.name,
        description: "Customer-facing support agent for initial technical triage and issue resolution.",
        status: activeAgent.status
      });
      setSkills([
        { id: 1, name: "Zendesk Integration", desc: "Read/Write ticket access", icon: "headset_mic" },
        { id: 2, name: "Stripe Refunds", desc: "Process limited refunds", icon: "payments" },
      ]);
    }
  }, [activeAgentId, activeAgent.name, activeAgent.status]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const knowledgeInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'memory' | 'knowledge') => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const newItem = {
      id: Date.now(),
      name: file.name,
      type: file.type || "Document",
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      icon: "description",
      size: target === 'knowledge' ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : undefined,
      color: "text-brand"
    };

    if (target === 'memory') {
      setMemories(prev => [newItem, ...prev]);
    } else {
      setKnowledge(prev => [newItem, ...prev]);
    }
  };

  const handleAddSkill = () => {
    const newSkill = { id: Date.now(), name: "New Custom Skill", desc: "Configure this new skill", icon: "extension" };
    setSkills(prev => [...prev, newSkill]);
  };

  return (
    <div className="flex h-full bg-parchment">
      {/* Secondary Drawer (Agents List) */}
      <div 
        className="h-full bg-surface-container border-r border-surface-container-highest flex flex-col shrink-0 relative"
        style={{ width: sidebarWidth }}
      >
        <div className="p-6 pb-4 border-b border-surface-container-highest">
          <h2 className="text-[12px] font-bold text-stone mb-3 uppercase tracking-widest">Agents</h2>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-stone text-[18px]">search</span>
            <input className="w-full pl-9 pr-3 py-2 bg-ivory border border-transparent rounded-lg text-sm focus:border-border-cream focus:ring-1 focus:ring-border-cream transition-all placeholder:text-stone/60" placeholder="Search agents..." type="text"/>
          </div>
        </div>
        
        <div className="flex-grow overflow-y-auto p-3 space-y-1 custom-scrollbar">
          <div className="px-3 py-2 mt-2">
            <span className="text-[10px] font-bold text-stone uppercase tracking-widest">All Agents</span>
          </div>
          
          {MOCK_AGENTS.map(agent => (
            <Link 
              key={agent.id}
              to={`/agents/${agent.id}`}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left group ${activeAgentId === agent.id ? 'bg-surface-container-high border border-border-cream text-charcoal shadow-sm' : 'hover:bg-surface-container-highest border border-transparent text-charcoal'}`}
            >
              <div className="w-8 h-8 rounded-full bg-ivory flex items-center justify-center shrink-0 border border-border-cream">
                <span className="material-symbols-outlined text-[16px] text-charcoal">{agent.icon}</span>
              </div>
              <div className="overflow-hidden">
                <p className={`text-sm truncate ${activeAgentId === agent.id ? 'font-semibold' : ''}`}>{agent.name}</p>
                <p className="text-[11px] text-stone truncate">{agent.status}</p>
              </div>
            </Link>
          ))}
        </div>
        
        <div className="mt-auto p-4 border-t border-surface-container-highest">
          <Link to="/agents/create" className="w-full flex items-center justify-center gap-2 bg-primary-container text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-charcoal transition-colors">
            <span className="material-symbols-outlined text-[18px]">add</span>
            Create Agent
          </Link>
        </div>

        <div 
          onMouseDown={startResizing}
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-brand/50 z-50 transition-colors -mr-[0.5px]"
        >
           {isResizing && <div className="absolute inset-y-0 w-8 -ml-4" />}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* TopAppBar */}
        <header className="bg-ivory/80 backdrop-blur-md sticky top-0 w-full border-b border-border-cream shadow-sm flex items-center px-6 py-4 z-30 shrink-0">
          <div className="flex items-center gap-2 text-sm">
            <Link to="/agents" className="text-stone hover:text-brand transition-colors">Agents</Link>
            <span className="material-symbols-outlined text-stone text-[16px]">chevron_right</span>
            <span className="font-bold text-charcoal">{activeAgent.name}</span>
          </div>
        </header>

        {/* Canvas */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
          <div className="max-w-[1200px] mx-auto flex flex-col gap-8">
            
            {/* Agent Profile Section */}
            <section className="bg-ivory border border-border-cream rounded-xl p-6 shadow-whisper">
              <div className="flex justify-between items-center mb-6 border-b border-border-cream pb-4">
                <h2 className="font-serif text-[20px] text-charcoal">Agent Profile</h2>
                {isEditingProfile ? (
                  <div className="flex items-center gap-2">
                    <button onClick={() => setIsEditingProfile(false)} className="px-4 py-1.5 rounded-lg text-sm font-semibold text-stone hover:bg-surface-container transition-colors">
                      Cancel
                    </button>
                    <button onClick={() => setIsEditingProfile(false)} className="flex items-center gap-2 text-sm font-semibold text-white bg-brand hover:bg-brand/90 transition-colors px-4 py-1.5 rounded-lg shadow-sm">
                      <span className="material-symbols-outlined text-[18px]">save</span>
                      Save Profile
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setIsEditingProfile(true)} className="flex items-center gap-2 text-sm font-semibold text-stone hover:text-brand transition-colors px-3 py-1.5 rounded-lg hover:bg-surface-container">
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                    Edit
                  </button>
                )}
              </div>
              
              <div className="flex flex-col lg:flex-row items-start gap-8">
                <div className="flex flex-col items-center gap-3 shrink-0">
                  <div className="h-24 w-24 rounded-full bg-secondary-container flex items-center justify-center border-2 border-[#d5c4ad] relative group cursor-pointer overflow-hidden">
                    <span className="material-symbols-outlined text-on-secondary-container text-[40px] group-hover:opacity-0 transition-opacity" style={{ fontVariationSettings: "'FILL' 1" }}>{activeAgent.icon}</span>
                    <div className="absolute inset-0 bg-charcoal/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="material-symbols-outlined text-white">edit</span>
                    </div>
                  </div>
                  {isEditingProfile && <button className="text-xs font-semibold text-stone hover:text-charcoal transition-colors">Change Avatar</button>}
                </div>

                <div className="flex-1 flex flex-col gap-4 w-full">
                  <div>
                    <label className="block text-xs font-bold tracking-widest uppercase text-stone mb-1.5">Agent Name</label>
                    {isEditingProfile ? (
                      <input type="text" value={profileData.name} onChange={(e) => setProfileData({...profileData, name: e.target.value})} className="w-full bg-surface-container-lowest border border-border-cream rounded-lg px-4 py-2.5 text-sm text-charcoal focus:border-charcoal focus:ring-1 focus:ring-charcoal outline-none transition-all shadow-sm" />
                    ) : (
                      <div className="text-lg font-semibold text-charcoal">{profileData.name}</div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold tracking-widest uppercase text-stone mb-1.5">Description</label>
                    {isEditingProfile ? (
                      <textarea value={profileData.description} onChange={(e) => setProfileData({...profileData, description: e.target.value})} rows={2} className="w-full bg-surface-container-lowest border border-border-cream rounded-lg px-4 py-2.5 text-sm text-charcoal focus:border-charcoal focus:ring-1 focus:ring-charcoal outline-none transition-all shadow-sm resize-none" />
                    ) : (
                      <div className="text-sm text-charcoal/80">{profileData.description}</div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-3 lg:pl-6 lg:border-l border-border-cream w-full lg:w-auto">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-medium text-stone">Status</span>
                    {isEditingProfile ? (
                      <>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" checked={profileData.status.includes('Active')} onChange={(e) => setProfileData({...profileData, status: e.target.checked ? "Active • Tier 1" : "Offline • Tier 1"})} />
                          <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container"></div>
                        </label>
                      </>
                    ) : (
                      <div className={`w-2 h-2 rounded-full ${profileData.status.includes('Active') ? 'bg-emerald-500' : 'bg-stone'}`}></div>
                    )}
                    <span className="font-semibold text-sm text-primary-container">{profileData.status.split(' •')[0]}</span>
                  </div>
                  <p className="text-xs text-stone">ID: agt_{activeAgent.id}</p>
                </div>
              </div>
            </section>

            {/* Bento Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Column (Spans 2) */}
              <div className="lg:col-span-2 flex flex-col gap-6">
                
                {/* Core Configuration Section */}
                <section className="bg-ivory border border-border-cream rounded-xl p-6 shadow-whisper">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="font-serif text-[24px] text-charcoal">Core Configuration</h2>
                    {isEditingCore ? (
                      <div className="flex items-center gap-2">
                        <button onClick={() => setIsEditingCore(false)} className="px-4 py-1.5 rounded-lg text-sm font-semibold text-stone hover:bg-surface-container transition-colors">
                          Cancel
                        </button>
                        <button onClick={() => setIsEditingCore(false)} className="flex items-center gap-2 text-sm font-semibold text-white bg-brand hover:bg-brand/90 transition-colors px-4 py-1.5 rounded-lg shadow-sm">
                          <span className="material-symbols-outlined text-[18px]">save</span>
                          Save config
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setIsEditingCore(true)} className="flex items-center gap-2 text-sm font-semibold text-stone hover:text-brand transition-colors px-3 py-1.5 rounded-lg hover:bg-surface-container">
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                        Edit
                      </button>
                    )}
                  </div>
                  
                  <div className="flex flex-col gap-6">
                    <div>
                      <label className="block text-[12px] font-bold tracking-widest uppercase text-stone mb-2">Base Model</label>
                      {isEditingCore ? (
                        <select 
                          value={coreConfig.model} 
                          onChange={(e) => setCoreConfig({...coreConfig, model: e.target.value})}
                          className="w-full bg-surface-container-lowest border border-border-cream rounded-lg p-3 text-[16px] text-charcoal shadow-sm outline-none focus:border-brand"
                        >
                          <option>GPT-4 Optimized (neptune-v2)</option>
                          <option>Claude 3.5 Sonnet</option>
                          <option>Gemini 1.5 Pro</option>
                        </select>
                      ) : (
                        <div className="bg-surface-container-low border border-border-cream rounded-lg p-3 text-[16px] text-charcoal flex items-center justify-between shadow-sm">
                          <span>{coreConfig.model}</span>
                          <span className="material-symbols-outlined text-stone text-[18px]">lock</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-[12px] font-bold tracking-widest uppercase text-stone mb-2">Role</label>
                      {isEditingCore ? (
                        <input 
                          type="text" 
                          value={coreConfig.role} 
                          onChange={(e) => setCoreConfig({...coreConfig, role: e.target.value})}
                          className="w-full bg-surface-container-lowest border border-border-cream rounded-lg p-3 text-[16px] text-charcoal shadow-sm outline-none focus:border-brand"
                        />
                      ) : (
                        <div className="bg-surface-container-low border border-border-cream rounded-lg p-3 text-[16px] text-charcoal shadow-sm">
                          {coreConfig.role}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-[12px] font-bold tracking-widest uppercase text-stone mb-2">System Prompt</label>
                      {isEditingCore ? (
                        <textarea 
                          value={coreConfig.systemPrompt} 
                          onChange={(e) => setCoreConfig({...coreConfig, systemPrompt: e.target.value})}
                          className="w-full bg-surface-container-lowest border border-border-cream rounded-lg p-4 text-sm text-charcoal h-32 overflow-y-auto leading-relaxed custom-scrollbar shadow-sm outline-none focus:border-brand resize-vertical"
                        />
                      ) : (
                        <div className="bg-surface-container-low border border-border-cream rounded-lg p-4 text-sm text-olive h-32 overflow-y-auto leading-relaxed custom-scrollbar shadow-sm">
                          {coreConfig.systemPrompt}
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                {/* Memories Section */}
                <section className="bg-ivory border border-border-cream rounded-xl p-6 shadow-whisper">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="font-serif text-[24px] text-charcoal">Memories</h2>
                    <div>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={(e) => handleFileUpload(e, 'memory')} 
                        className="hidden" 
                      />
                      <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 font-semibold text-sm text-charcoal bg-sand hover:bg-[#d5c4ad] transition-colors px-4 py-2 rounded-lg border border-border-cream cursor-pointer">
                        <span className="material-symbols-outlined text-[18px]">upload_file</span>
                        Upload Document
                      </button>
                    </div>
                  </div>
                  
                  <div className="border border-border-cream rounded-lg overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-surface-container-low border-b border-border-cream">
                          <th className="text-[12px] font-bold tracking-widest uppercase text-stone py-3 px-4">File Name</th>
                          <th className="text-[12px] font-bold tracking-widest uppercase text-stone py-3 px-4">Type</th>
                          <th className="text-[12px] font-bold tracking-widest uppercase text-stone py-3 px-4">Uploaded</th>
                          <th className="py-3 px-4"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-cream bg-ivory">
                        {memories.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-6 text-center text-sm text-stone">No memories uploaded yet.</td>
                          </tr>
                        ) : memories.map(memory => (
                          <tr key={memory.id} className="hover:bg-surface-container/50 transition-colors group">
                            <td className="py-3 px-4 flex items-center gap-3">
                              <span className="material-symbols-outlined text-stone">{memory.icon}</span>
                              <span className="text-sm text-charcoal font-medium">{memory.name}</span>
                            </td>
                            <td className="py-3 px-4 text-sm text-stone">{memory.type}</td>
                            <td className="py-3 px-4 text-sm text-stone">{memory.date}</td>
                            <td className="py-3 px-4 text-right">
                              <button 
                                onClick={() => setMemories(memories.filter(m => m.id !== memory.id))}
                                className="text-stone hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                title="Delete"
                              >
                                <span className="material-symbols-outlined text-[20px]">delete</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
                
              </div>

              {/* Right Column */}
              <div className="flex flex-col gap-6">
                
                {/* Cost Control Section */}
                <section className="bg-ivory border border-border-cream rounded-xl p-6 shadow-whisper">
                  <h2 className="font-serif text-[24px] text-charcoal mb-6">Cost Control</h2>
                  <div className="flex flex-col gap-4">
                    <div className="bg-surface-container-low rounded-xl p-5 border border-border-cream">
                      <span className="text-[12px] font-bold tracking-widest uppercase text-stone mb-1 block">MTD Token Cost</span>
                      <div className="flex items-baseline gap-2">
                        <span className="font-serif text-[30px] text-charcoal font-medium">$142.50</span>
                        <span className="text-sm text-stone">/ $500 limit</span>
                      </div>
                      <div className="w-full bg-[#e6e1e0] h-1.5 rounded-full mt-4 overflow-hidden">
                        <div className="bg-charcoal h-full rounded-full" style={{ width: '28%' }}></div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-surface-container-low border border-border-cream rounded-xl p-4">
                        <span className="text-[12px] font-bold tracking-widest uppercase text-stone mb-2 block">30-Day Sessions</span>
                        <span className="font-serif text-[24px] text-charcoal">1,204</span>
                      </div>
                      <div className="bg-surface-container-low border border-border-cream rounded-xl p-4">
                        <span className="text-[12px] font-bold tracking-widest uppercase text-stone mb-2 block">Avg Latency</span>
                        <span className="font-serif text-[24px] text-charcoal">450ms</span>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Assigned Skills Section */}
                <section className="bg-ivory border border-border-cream rounded-xl p-6 shadow-whisper flex-1">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="font-serif text-[24px] text-charcoal">Assigned Skills</h2>
                    <button onClick={handleAddSkill} className="text-charcoal hover:text-brand transition-colors">
                      <span className="material-symbols-outlined">add_circle</span>
                    </button>
                  </div>
                  
                  <div className="flex flex-col gap-3">
                    {skills.map(skill => (
                      <div key={skill.id} className="flex items-center gap-4 p-3 rounded-xl border border-border-cream bg-white hover:bg-surface-container-lowest transition-colors shadow-sm group">
                        <div className="h-10 w-10 rounded bg-[#e3e2e4] flex items-center justify-center text-[#1a1c1d]">
                          <span className="material-symbols-outlined text-[20px]">{skill.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-[16px] font-medium text-charcoal truncate">{skill.name}</h3>
                          <p className="text-sm text-stone truncate">{skill.desc}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="px-2.5 py-1 bg-surface-container-low rounded-full border border-border-cream">
                            <span className="text-[10px] font-bold tracking-widest uppercase text-stone">Active</span>
                          </div>
                          <button 
                            onClick={() => setSkills(skills.filter(s => s.id !== skill.id))}
                            className="text-stone hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1"
                            title="Remove Skill"
                          >
                            <span className="material-symbols-outlined text-[18px]">close</span>
                          </button>
                        </div>
                      </div>
                    ))}
                    
                    <button onClick={handleAddSkill} className="w-full flex items-center gap-3 p-3 rounded-xl border border-border-cream border-dashed bg-surface-container-low hover:bg-surface-container transition-colors justify-center mt-2">
                      <span className="font-semibold text-sm text-stone">Browse Skill Catalog</span>
                    </button>
                  </div>
                </section>
                
              </div>
            </div>

            {/* Knowledge Base Section */}
            <section className="bg-ivory border border-border-cream rounded-xl p-6 shadow-whisper">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="font-serif text-[24px] text-charcoal">Knowledge Base</h2>
                  <p className="text-sm text-stone mt-1">Manage domain-specific documents (PDF, Markdown, Word, Excel)</p>
                </div>
                <div>
                  <input 
                    type="file" 
                    ref={knowledgeInputRef} 
                    onChange={(e) => handleFileUpload(e, 'knowledge')} 
                    className="hidden" 
                  />
                  <button onClick={() => knowledgeInputRef.current?.click()} className="flex items-center gap-2 font-semibold text-sm text-charcoal bg-sand hover:bg-[#d5c4ad] transition-colors px-4 py-2 rounded-lg border border-border-cream">
                    <span className="material-symbols-outlined text-[18px]">upload_file</span>
                    Upload Knowledge
                  </button>
                </div>
              </div>
              
              <div className="border border-border-cream rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low border-b border-border-cream">
                      <th className="text-[12px] font-bold tracking-widest uppercase text-stone py-3 px-4">File Name</th>
                      <th className="text-[12px] font-bold tracking-widest uppercase text-stone py-3 px-4">Type</th>
                      <th className="text-[12px] font-bold tracking-widest uppercase text-stone py-3 px-4">Size</th>
                      <th className="text-[12px] font-bold tracking-widest uppercase text-stone py-3 px-4">Uploaded</th>
                      <th className="py-3 px-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-cream bg-ivory">
                    {knowledge.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-sm text-stone">No knowledge bases uploaded yet.</td>
                      </tr>
                    ) : knowledge.map(item => (
                      <tr key={item.id} className="hover:bg-surface-container/50 transition-colors group">
                        <td className="py-3 px-4 flex items-center gap-3">
                          <span className={`material-symbols-outlined ${item.color}`}>{item.icon}</span>
                          <span className="text-sm text-charcoal font-medium">{item.name}</span>
                        </td>
                        <td className="py-3 px-4 text-sm text-stone">{item.type}</td>
                        <td className="py-3 px-4 text-sm text-stone">{item.size}</td>
                        <td className="py-3 px-4 text-sm text-stone">{item.date}</td>
                        <td className="py-3 px-4 text-right">
                          <button 
                            onClick={() => setKnowledge(knowledge.filter(k => k.id !== item.id))}
                            className="text-stone hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                            title="Delete"
                          >
                            <span className="material-symbols-outlined text-[20px]">delete</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Danger Zone */}
            <section className="mt-8 border-t border-border-cream pt-8">
              <button 
                onClick={handleDeleteClick}
                className="w-full flex items-center justify-center gap-2 font-semibold text-base text-white bg-red-700 hover:bg-red-800 transition-colors px-6 py-3.5 rounded-xl shadow-sm"
              >
                <span className="material-symbols-outlined text-[20px]">delete_forever</span>
                Delete Agent
              </button>
            </section>

            {/* Delete Modal */}
            {isDeleting && (
              <div className="fixed inset-0 bg-charcoal/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsDeleting(false)}>
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-border-cream" onClick={e => e.stopPropagation()}>
                  <div className="p-6 border-b border-border-cream bg-red-50/50">
                    <h3 className="text-xl font-serif text-red-700 flex items-center gap-2">
                      <span className="material-symbols-outlined">warning</span>
                      Delete "{profileData.name}"?
                    </h3>
                  </div>
                  <div className="p-6 flex flex-col gap-5">
                    <p className="text-sm text-charcoal leading-relaxed">
                      This action <strong>cannot</strong> be undone. This will permanently delete the <strong>{profileData.name}</strong> agent, including all associated memories, knowledge bases, and core configurations.
                    </p>
                    
                    <div className="bg-surface-container-lowest p-4 rounded-lg border border-border-cream shadow-inner">
                      <label className="text-sm font-semibold text-charcoal">
                        Please type <span className="font-mono bg-red-100 text-red-700 px-1.5 py-0.5 rounded select-all selection:bg-red-200">{expectedDeleteCode}</span> to confirm.
                      </label>
                      <input 
                        type="text" 
                        value={deleteInputText}
                        onChange={(e) => setDeleteInputText(e.target.value)}
                        className="w-full bg-white border border-border-cream rounded-lg px-4 py-2.5 text-sm font-mono text-charcoal focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all mt-3"
                        placeholder={expectedDeleteCode}
                      />
                    </div>
                  </div>
                  <div className="p-5 border-t border-border-cream bg-surface-container-lowest flex justify-end gap-3 rounded-b-xl border-t-0 p-t-4">
                    <button 
                      onClick={() => setIsDeleting(false)} 
                      className="px-5 py-2.5 rounded-lg text-sm font-semibold text-stone hover:bg-surface-container-highest transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={confirmDelete}
                      disabled={deleteInputText !== expectedDeleteCode}
                      className="flex items-center gap-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:bg-red-300 disabled:border-red-300 disabled:text-white/70 disabled:cursor-not-allowed transition-colors px-6 py-2.5 rounded-lg shadow-sm border border-red-600"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete_forever</span>
                      I understand, delete this agent
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
