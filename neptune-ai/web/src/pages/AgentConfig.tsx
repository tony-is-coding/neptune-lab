import React, { useState, useRef, useEffect, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useResizableSidebar } from '../hooks/useResizableSidebar';
import { listAgents, getAgent, updateAgent, deleteAgent, uploadAgentDocument, deleteAgentDocument, getAgentStats, listAgentDocuments, listSkills, assignSkillToAgent, removeSkillFromAgent, type AgentStats, type Skill } from '../api/agents';
import { listThreads, createThread } from '../api/threads';
import type { AgentTemplate } from '../types/chat';

export function AgentConfig() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [agents, setAgents] = useState<AgentTemplate[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [activeAgent, setActiveAgent] = useState<AgentTemplate | null>(null);
  const [agentLoading, setAgentLoading] = useState(true);
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // 使用 useCallback 稳定 navigate 引用，避免 useEffect 无限循环
  const stableNavigate = useCallback(navigate, []);

  const { sidebarWidth, isResizing, startResizing } = useResizableSidebar(240, 200, 400);

  const [isEditingCore, setIsEditingCore] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const [profileData, setProfileData] = useState({
    name: "",
    description: "",
    status: "Active"
  });

  const [coreConfig, setCoreConfig] = useState({
    model: "",
    role: "",
    systemPrompt: ""
  });

  const [memories, setMemories] = useState<Array<{ id: string; name: string; type: string; size?: string; date: string; icon: string; color: string }>>([]);
  const [knowledge, setKnowledge] = useState<Array<{ id: string; name: string; type: string; size?: string; date: string; icon: string; color: string }>>([]);

  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteInputText, setDeleteInputText] = useState("");
  const [expectedDeleteCode, setExpectedDeleteCode] = useState("");

  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Skills 弹窗状态
  const [showSkillModal, setShowSkillModal] = useState(false);
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [assigningSkillId, setAssigningSkillId] = useState<string | null>(null);

  // Load agents list
  useEffect(() => {
    let cancelled = false;
    setAgentsLoading(true);

    listAgents()
      .then(res => {
        if (cancelled) return;
        setAgents(res.data);

        // 如果 URL 有 id，确保 id 在列表中
        if (id && !res.data.some(a => a.id === id)) {
          setLoadError(`Agent ${id} not found`);
        }
      })
      .catch(err => {
        console.error('Failed to load agents:', err);
        if (!cancelled) setLoadError('Failed to load agents. Please check if the server is running.');
      })
      .finally(() => {
        if (!cancelled) setAgentsLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  // Load active agent
  useEffect(() => {
    if (!id) {
      setActiveAgent(null);
      setAgentLoading(false);
      setStatsLoading(false);
      return;
    }

    const activeAgentId = id;
    setAgentLoading(true);
    setStatsLoading(true);
    setLoadError(null);

    // 先加载 Agent 数据
    getAgent(activeAgentId)
      .then(agentData => {
        setActiveAgent(agentData);

        setProfileData({
          name: agentData.name,
          description: agentData.description || "",
          status: agentData.isActive ? "Active" : "Inactive"
        });

        setCoreConfig({
          model: agentData.modelConfig.model,
          role: agentData.description || "",
          systemPrompt: agentData.systemPrompt
        });

        // Agent 加载成功后，并行加载 stats 和文档列表（失败不影响主体内容）
        const statsPromise = getAgentStats(activeAgentId)
          .then(statsData => {
            setStats(statsData);
          })
          .catch(() => {
            setStats(null);
          })
          .finally(() => {
            setStatsLoading(false);
          });

        const docsPromise = listAgentDocuments(activeAgentId)
          .then(docs => {
            const formatted = docs.map(doc => ({
              id: doc.id,
              name: doc.name,
              type: doc.type,
              date: doc.uploadedAt
                ? new Date(doc.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : '',
              icon: getFileIcon(doc.type),
              size: doc.size ? formatFileSize(doc.size) : undefined,
              color: 'text-brand',
            }));
            // 后端没有 category 字段，暂将所有文档视为 memory
            setMemories(formatted);
            setKnowledge([]);
          })
          .catch(err => {
            console.warn('Failed to load documents:', err);
          });

        return Promise.all([statsPromise, docsPromise]);
      })
      .catch(err => {
        console.error('Failed to load agent:', err);
        if (err instanceof Error) {
          if (err.message === 'Request timeout') {
            setLoadError('Request timeout. Please check if the server is running.');
          } else if (err.message === 'Agent not found') {
            setLoadError('Agent not found');
          } else if (err.message.includes('401') || err.message === 'Unauthorized') {
            stableNavigate('/login');
          } else {
            setLoadError('Failed to load agent details. Please check if the server is running.');
          }
        } else {
          setLoadError('Failed to load agent details. Please check if the server is running.');
        }
      })
      .finally(() => {
        setAgentLoading(false);
      });
  }, [id, stableNavigate]);

  const handleSaveProfile = async () => {
    if (!activeAgent) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const updated = await updateAgent(activeAgent.id, {
        name: profileData.name,
        description: profileData.description,
      });

      setActiveAgent(updated);
      setIsEditingProfile(false);

      // Update agents list
      setAgents(prev => prev.map(a => a.id === updated.id ? updated : a));
    } catch (err) {
      console.error('Failed to update agent:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveCore = async () => {
    if (!activeAgent) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const updated = await updateAgent(activeAgent.id, {
        systemPrompt: coreConfig.systemPrompt,
        modelConfig: {
          model: coreConfig.model,
        },
      });

      setActiveAgent(updated);
      setIsEditingCore(false);

      // Update agents list
      setAgents(prev => prev.map(a => a.id === updated.id ? updated : a));
    } catch (err) {
      console.error('Failed to update agent:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = () => {
    setExpectedDeleteCode(Math.random().toString(36).substring(2, 6).toUpperCase());
    setDeleteInputText("");
    setIsDeleting(true);
  };

  const confirmDelete = async () => {
    if (!activeAgent || deleteInputText !== expectedDeleteCode) return;

    try {
      await deleteAgent(activeAgent.id);
      navigate('/agents');
    } catch (err) {
      console.error('Failed to delete agent:', err);
      alert('Failed to delete agent');
      setIsDeleting(false);
    }
  };

  const handleStartCollaborate = async () => {
    if (!activeAgent) return;

    try {
      // 查询是否已有 Thread
      const res = await listThreads(activeAgent.id);
      let threadId: string;

      if (res.data.length > 0) {
        // 非第一次：进入最新的 Thread
        threadId = res.data[0].id;
      } else {
        // 第一次：创建新的 Thread
        const newThread = await createThread(activeAgent.id);
        threadId = newThread.id;
      }

      navigate(`/collaborate/${activeAgent.id}`, { state: { threadId } });
    } catch (err) {
      console.error('Failed to start collaborate:', err);
      // 降级：直接导航到 collaborate 页面
      navigate(`/collaborate/${activeAgent.id}`);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const knowledgeInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'memory' | 'knowledge') => {
    const file = e.target.files?.[0];
    if (!file || !activeAgent) return;

    try {
      const doc = await uploadAgentDocument(activeAgent.id, file);
      const newItem = {
        id: doc.id,
        name: doc.name,
        type: doc.type,
        date: new Date(doc.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        icon: getFileIcon(doc.type),
        size: doc.size ? formatFileSize(doc.size) : undefined,
        color: "text-brand"
      };

      if (target === 'memory') {
        setMemories(prev => [newItem, ...prev]);
      } else {
        setKnowledge(prev => [newItem, ...prev]);
      }
    } catch (err) {
      console.error('Failed to upload document:', err);
      alert('Failed to upload document');
    }

    // Reset file input
    if (e.target) e.target.value = '';
  };

  const handleDeleteMemory = async (memoryId: string) => {
    if (!activeAgent) return;

    try {
      await deleteAgentDocument(activeAgent.id, memoryId);
      setMemories(prev => prev.filter(m => m.id !== memoryId));
    } catch (err) {
      console.error('Failed to delete document:', err);
      alert('Failed to delete document');
    }
  };

  const handleDeleteKnowledge = async (knowledgeId: string) => {
    if (!activeAgent) return;

    try {
      await deleteAgentDocument(activeAgent.id, knowledgeId);
      setKnowledge(prev => prev.filter(k => k.id !== knowledgeId));
    } catch (err) {
      console.error('Failed to delete document:', err);
      alert('Failed to delete document');
    }
  };

  // 根据文件类型返回 Material Symbols 图标名
  function getFileIcon(type: string): string {
    const t = (type || '').toLowerCase();
    if (t.includes('pdf')) return 'picture_as_pdf';
    if (t.includes('csv') || t.includes('excel') || t.includes('spreadsheet') || t.includes('xls')) return 'table_chart';
    if (t.includes('markdown') || t.includes('md')) return 'article';
    if (t.includes('json')) return 'data_object';
    if (t.includes('word') || t.includes('doc')) return 'description';
    if (t.includes('text') || t.includes('txt')) return 'text_snippet';
    return 'description';
  }

  // 格式化文件大小
  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // 打开 Skill Catalog 弹窗
  const handleBrowseSkills = async () => {
    if (!activeAgent) return;
    setShowSkillModal(true);
    setSkillsLoading(true);
    try {
      const skills = await listSkills();
      setAllSkills(skills);
    } catch (err) {
      console.error('Failed to load skills:', err);
      setAllSkills([]);
    } finally {
      setSkillsLoading(false);
    }
  };

  // 分配 Skill 给当前 Agent
  const handleAssignSkill = async (skill: Skill) => {
    if (!activeAgent) return;
    setAssigningSkillId(skill.id);
    try {
      await assignSkillToAgent(skill.id, activeAgent.id);
      // 更新 agent 的 skills 列表
      const updated = {
        ...activeAgent,
        skills: [...activeAgent.skills, { id: skill.id, name: skill.name, version: 'v1.0' }],
      };
      setActiveAgent(updated);
      setAgents(prev => prev.map(a => a.id === updated.id ? updated : a));
    } catch (err) {
      console.error('Failed to assign skill:', err);
      alert('Failed to assign skill');
    } finally {
      setAssigningSkillId(null);
    }
  };

  // 从当前 Agent 移除 Skill
  const handleRemoveSkill = async (skillId: string) => {
    if (!activeAgent) return;
    try {
      await removeSkillFromAgent(skillId, activeAgent.id);
      const updated = {
        ...activeAgent,
        skills: activeAgent.skills.filter(s => s.id !== skillId),
      };
      setActiveAgent(updated);
      setAgents(prev => prev.map(a => a.id === updated.id ? updated : a));
    } catch (err) {
      console.error('Failed to remove skill:', err);
      alert('Failed to remove skill');
    }
  };

  // 当有 id 时，加载 agent 数据期间显示加载状态
  if (id && agentLoading) {
    return (
      <div className="flex h-full bg-surface-container-low items-center justify-center">
        <div className="w-6 h-6 border-2 border-stone/30 border-t-charcoal rounded-full animate-spin" />
      </div>
    );
  }

  // 当有 id 但 agent 加载失败或未找到时，显示错误状态
  if (id && (!activeAgent || loadError)) {
    return (
      <div className="flex h-full bg-surface-container-low items-center justify-center">
        <div className="text-center">
          <span className="material-symbols-outlined text-[40px] text-stone/40 block mb-3">error_outline</span>
          <p className="text-sm text-stone mb-2">{loadError || 'Agent not found'}</p>
          <Link to="/agents" className="text-sm text-charcoal font-medium hover:underline">
            &larr; Back to Agents
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-surface-container-low">
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

          {agentsLoading ? (
            <div className="flex items-center justify-center h-32">
              <span className="text-[11px] text-stone">Loading agents...</span>
            </div>
          ) : agents.map(agent => (
            <Link
              key={agent.id}
              to={`/agents/${agent.id}`}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left group ${activeAgent?.id === agent.id ? 'bg-surface-container-high border border-border-cream text-charcoal shadow-sm' : 'hover:bg-surface-container-highest border border-transparent text-charcoal'}`}
            >
              <div className="w-8 h-8 rounded-full bg-ivory flex items-center justify-center shrink-0 border border-border-cream">
                <span className="material-symbols-outlined text-[16px] text-charcoal">{agent.icon || 'smart_toy'}</span>
              </div>
              <div className="overflow-hidden">
                <p className={`text-sm truncate ${activeAgent?.id === agent.id ? 'font-semibold' : ''}`}>{agent.name}</p>
                <p className="text-[11px] text-stone truncate">{agent.isActive ? 'Active' : 'Inactive'}</p>
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
        {!activeAgent ? (
          <div className="flex-1 flex flex-col items-center justify-center text-stone">
            <span className="material-symbols-outlined text-[48px] text-stone/30">smart_toy</span>
            <p className="text-sm mt-3">Select an agent to view configuration</p>
          </div>
        ) : (
        <>
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
                <div className="flex items-center gap-3">
                  {/* Starting Collaborate Button */}
                  <button
                    onClick={handleStartCollaborate}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm bg-brand text-white hover:bg-brand/90 transition-colors shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[18px]">forum</span>
                    Start Collaborate
                  </button>

                  {isEditingProfile ? (
                    <div className="flex items-center gap-2">
                      <button onClick={() => setIsEditingProfile(false)} className="px-4 py-1.5 rounded-lg text-sm font-semibold text-stone hover:bg-surface-container transition-colors">
                        Cancel
                      </button>
                      <button onClick={handleSaveProfile} disabled={isSaving} className="flex items-center gap-2 text-sm font-semibold text-white bg-brand hover:bg-brand/90 transition-colors px-4 py-1.5 rounded-lg shadow-sm disabled:opacity-50">
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
              </div>

              <div className="flex flex-col lg:flex-row items-start gap-8">
                <div className="flex flex-col items-center gap-3 shrink-0">
                  <div className="h-24 w-24 rounded-full bg-secondary-container flex items-center justify-center border-2 border-[#d5c4ad] relative group cursor-pointer overflow-hidden">
                    <span className="material-symbols-outlined text-on-secondary-container text-[40px] group-hover:opacity-0 transition-opacity" style={{ fontVariationSettings: "'FILL' 1" }}>{activeAgent.icon || 'smart_toy'}</span>
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
                          <input type="checkbox" className="sr-only peer" checked={profileData.status === 'Active'} onChange={(e) => setProfileData({...profileData, status: e.target.checked ? "Active" : "Inactive"})} />
                          <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container"></div>
                        </label>
                      </>
                    ) : (
                      <div className={`w-2 h-2 rounded-full ${profileData.status === 'Active' ? 'bg-emerald-500' : 'bg-stone'}`}></div>
                    )}
                    <span className="font-semibold text-sm text-primary-container">{profileData.status}</span>
                  </div>
                  <p className="text-xs text-stone">ID: {activeAgent.id}</p>
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
                        <button onClick={handleSaveCore} disabled={isSaving} className="flex items-center gap-2 text-sm font-semibold text-white bg-brand hover:bg-brand/90 transition-colors px-4 py-1.5 rounded-lg shadow-sm disabled:opacity-50">
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
                          <option>GPT-4o</option>
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
                                onClick={() => handleDeleteMemory(memory.id)}
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
                    {statsLoading ? (
                      <div className="bg-surface-container-low rounded-xl p-5 border border-border-cream">
                        <span className="text-[12px] font-bold tracking-widest uppercase text-stone mb-1 block">MTD Token Cost</span>
                        <div className="w-full h-8 bg-surface-container-highest rounded animate-pulse" />
                      </div>
                    ) : stats ? (
                      <>
                        <div className="bg-surface-container-low rounded-xl p-5 border border-border-cream">
                          <span className="text-[12px] font-bold tracking-widest uppercase text-stone mb-1 block">MTD Token Cost</span>
                          <div className="flex items-baseline gap-2">
                            <span className="font-serif text-[30px] text-charcoal font-medium">${(stats.mtdTokenCost ?? stats.mtdCost ?? 0).toFixed(2)}</span>
                            <span className="text-sm text-stone">/ ${stats.mtdTokenLimit ?? stats.budgetLimit ?? 0} limit</span>
                          </div>
                          <div className="w-full bg-[#e6e1e0] h-1.5 rounded-full mt-4 overflow-hidden">
                            <div className="bg-charcoal h-full rounded-full" style={{ width: `${((stats.mtdTokenCost ?? stats.mtdCost ?? 0) / (stats.mtdTokenLimit ?? stats.budgetLimit ?? 1)) * 100}%` }}></div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-surface-container-low border border-border-cream rounded-xl p-4">
                            <span className="text-[12px] font-bold tracking-widest uppercase text-stone mb-2 block">30-Day Sessions</span>
                            <span className="font-serif text-[24px] text-charcoal">{(stats.sessions30Days ?? stats.thirtyDaySessions ?? 0).toLocaleString()}</span>
                          </div>
                          <div className="bg-surface-container-low border border-border-cream rounded-xl p-4">
                            <span className="text-[12px] font-bold tracking-widest uppercase text-stone mb-2 block">Avg Latency</span>
                            <span className="font-serif text-[24px] text-charcoal">{stats.avgLatency}ms</span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="bg-surface-container-low rounded-xl p-5 border border-border-cream">
                        <span className="text-[12px] font-bold tracking-widest uppercase text-stone mb-1 block">MTD Token Cost</span>
                        <p className="text-sm text-stone">Stats not available</p>
                      </div>
                    )}
                  </div>
                </section>

                {/* Assigned Skills Section */}
                <section className="bg-ivory border border-border-cream rounded-xl p-6 shadow-whisper flex-1">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="font-serif text-[24px] text-charcoal">Assigned Skills</h2>
                    <button className="text-charcoal hover:text-brand transition-colors">
                      <span className="material-symbols-outlined">add_circle</span>
                    </button>
                  </div>

                  <div className="flex flex-col gap-3">
                    {activeAgent.skills.map(skill => (
                      <div key={skill.id} className="flex items-center gap-4 p-3 rounded-xl border border-border-cream bg-white hover:bg-surface-container-lowest transition-colors shadow-sm group">
                        <div className="h-10 w-10 rounded bg-[#e3e2e4] flex items-center justify-center text-[#1a1c1d]">
                          <span className="material-symbols-outlined text-[20px]">extension</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-[16px] font-medium text-charcoal truncate">{skill.name}</h3>
                          <p className="text-sm text-stone truncate">{skill.version || 'v1.0'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="px-2.5 py-1 bg-surface-container-low rounded-full border border-border-cream">
                            <span className="text-[10px] font-bold tracking-widest uppercase text-stone">Active</span>
                          </div>
                          <button
                            onClick={() => handleRemoveSkill(skill.id)}
                            className="text-stone hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                            title="Remove skill"
                          >
                            <span className="material-symbols-outlined text-[20px]">close</span>
                          </button>
                        </div>
                      </div>
                    ))}

                    {activeAgent.skills.length === 0 && (
                      <p className="text-sm text-stone text-center py-4">No skills assigned</p>
                    )}

                    <button
                      onClick={handleBrowseSkills}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-border-cream border-dashed bg-surface-container-low hover:bg-surface-container transition-colors justify-center mt-2"
                    >
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
                            onClick={() => handleDeleteKnowledge(item.id)}
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

            {/* Skill Catalog Modal */}
            {showSkillModal && activeAgent && (
              <div className="fixed inset-0 bg-charcoal/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowSkillModal(false)}>
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-border-cream max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                  <div className="p-6 border-b border-border-cream">
                    <h3 className="text-xl font-serif text-charcoal flex items-center gap-2">
                      <span className="material-symbols-outlined">extension</span>
                      Skill Catalog
                    </h3>
                    <p className="text-sm text-stone mt-1">Select skills to assign to {activeAgent.name}</p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {skillsLoading ? (
                      <div className="flex items-center justify-center h-32">
                        <div className="w-6 h-6 border-2 border-stone/30 border-t-charcoal rounded-full animate-spin" />
                      </div>
                    ) : allSkills.length === 0 ? (
                      <p className="text-sm text-stone text-center py-8">No skills available. Create skills first.</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {allSkills.map(skill => {
                          const isAssigned = activeAgent.skills.some(s => s.id === skill.id);
                          const isAssigning = assigningSkillId === skill.id;
                          return (
                            <div key={skill.id} className="flex items-center gap-3 p-3 rounded-lg border border-border-cream hover:bg-surface-container-low transition-colors">
                              <div className="h-9 w-9 rounded bg-[#e3e2e4] flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-[18px] text-[#1a1c1d]">extension</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-medium text-charcoal truncate">{skill.name}</h4>
                                <p className="text-xs text-stone truncate">{skill.description || 'No description'}</p>
                              </div>
                              <div className="shrink-0">
                                {isAssigned ? (
                                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">Assigned</span>
                                ) : isAssigning ? (
                                  <div className="w-5 h-5 border-2 border-stone/30 border-t-charcoal rounded-full animate-spin" />
                                ) : (
                                  <button
                                    onClick={() => handleAssignSkill(skill)}
                                    className="text-xs font-semibold text-white bg-brand hover:bg-brand/90 px-3 py-1.5 rounded-lg transition-colors"
                                  >
                                    Add
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="p-4 border-t border-border-cream bg-surface-container-lowest flex justify-end">
                    <button
                      onClick={() => setShowSkillModal(false)}
                      className="px-5 py-2 rounded-lg text-sm font-semibold text-stone hover:bg-surface-container-highest transition-colors"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
