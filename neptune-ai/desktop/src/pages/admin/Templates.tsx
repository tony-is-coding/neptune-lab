import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import type { AgentTemplate } from '../../types';

/**
 * Agent Detail form data for editing
 */
interface AgentFormData {
  name: string;
  description: string;
  systemPrompt: string;
  modelConfig: {
    provider: string;
    model: string;
    temperature: number;
    maxTokens: number;
  };
  role: string;
}

/**
 * Mock memory file entry (placeholder until backend API is ready)
 */
interface MemoryFile {
  name: string;
  type: string;
  uploadedAt: string;
}

/**
 * Mock skill entry
 */
interface AssignedSkill {
  id: string;
  name: string;
  description: string;
  icon: string;
  isActive: boolean;
}

// Mock data for memories (placeholder)
const mockMemories: MemoryFile[] = [
  { name: 'product-specs.pdf', type: 'PDF', uploadedAt: '2026-04-28' },
  { name: 'brand-guidelines.md', type: 'Markdown', uploadedAt: '2026-04-25' },
  { name: 'faq-knowledge-base.json', type: 'JSON', uploadedAt: '2026-04-20' },
];

// Mock data for skills (placeholder)
const mockSkills: AssignedSkill[] = [
  { id: '1', name: 'Web Search', description: 'Search the internet for up-to-date information', icon: 'search', isActive: true },
  { id: '2', name: 'Code Interpreter', description: 'Execute Python code in a sandboxed environment', icon: 'code', isActive: true },
];

/**
 * Agent Management Detail Page
 * Displays detailed view and editing of a single agent configuration.
 */
export function Templates() {
  const { agentId } = useParams<{ agentId: string }>();

  // Agent data state
  const [agent, setAgent] = useState<AgentTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<AgentFormData | null>(null);
  const [saving, setSaving] = useState(false);

  // Status toggle state
  const [togglingStatus, setTogglingStatus] = useState(false);

  // Load agent data
  const loadAgent = useCallback(async () => {
    if (!agentId) return;
    try {
      setLoading(true);
      setError('');
      const data = await apiClient.getAgent(agentId);
      setAgent(data);
      setFormData({
        name: data.name,
        description: data.description || '',
        systemPrompt: data.systemPrompt,
        modelConfig: { ...data.modelConfig },
        role: data.description || '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agent');
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    loadAgent();
  }, [loadAgent]);

  // Toggle agent active status
  const handleToggleStatus = async () => {
    if (!agent) return;
    try {
      setTogglingStatus(true);
      if (agent.isActive) {
        await apiClient.deactivateAgent(agent.id);
      } else {
        await apiClient.activateAgent(agent.id);
      }
      setAgent({ ...agent, isActive: !agent.isActive });
    } catch (err) {
      console.error('Failed to toggle agent status:', err);
    } finally {
      setTogglingStatus(false);
    }
  };

  // Enter edit mode
  const handleEdit = () => {
    if (!agent) return;
    setFormData({
      name: agent.name,
      description: agent.description || '',
      systemPrompt: agent.systemPrompt,
      modelConfig: { ...agent.modelConfig },
      role: agent.description || '',
    });
    setIsEditing(true);
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setIsEditing(false);
    if (agent) {
      setFormData({
        name: agent.name,
        description: agent.description || '',
        systemPrompt: agent.systemPrompt,
        modelConfig: { ...agent.modelConfig },
        role: agent.description || '',
      });
    }
  };

  // Save changes
  const handleSave = async () => {
    if (!agent || !formData) return;
    try {
      setSaving(true);
      const updated = await apiClient.updateAgent(agent.id, {
        name: formData.name,
        description: formData.role,
        systemPrompt: formData.systemPrompt,
        modelConfig: formData.modelConfig,
      });
      setAgent(updated);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  // Format date string
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-np-border-light border-t-np-primary rounded-full animate-spin" />
          <p className="text-sm text-np-text-muted">Loading agent...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !agent) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-np-red mb-2">{error}</p>
          <button
            onClick={loadAgent}
            className="text-sm text-np-primary hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // No agent found
  if (!agent) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-np-text-muted">Agent not found</p>
      </div>
    );
  }

  // Derive a display short ID
  const shortId = `agt_${agent.id.slice(0, 6)}`;

  // Agent icon background color (deterministic based on name)
  const iconColors = ['#f2e0c8', '#e6f4ea', '#fce8e6', '#e8f0fe', '#f3e8ff', '#fef3c7'];
  const iconBg = iconColors[agent.name.length % iconColors.length];

  return (
    <div className="h-full flex">
      {/* Secondary Drawer — 208px per Figma */}
      <div className="w-[208px] bg-np-sidebar border-r border-np-border-lighter p-4 flex flex-col gap-4 shrink-0">
        <div>
          <p className="text-[12px] font-bold text-np-text-secondary tracking-[0.6px] uppercase mb-3 px-2">AGENTS</p>
          <Link
            to="/"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-np-text-muted hover:bg-white/50 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to List
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-[1200px] mx-auto px-8 py-6">

          {/* ===== TopAppBar ===== */}
          <div className="flex items-center justify-between mb-6">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm">
              <Link
                to="/"
                className="text-np-text-muted hover:text-np-text transition-colors"
              >
                Agents
              </Link>
              <svg className="w-4 h-4 text-np-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-np-text font-medium">Detail</span>
            </nav>

            {/* Edit / Save / Cancel buttons */}
            {!isEditing ? (
              <div />
            ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={handleCancelEdit}
                className="px-5 py-2 text-sm font-medium text-np-text-secondary bg-np-bg-warm border border-np-border rounded-lg hover:bg-np-sidebar transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 bg-np-primary text-white text-sm font-medium rounded-lg hover:bg-np-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>

        {/* ===== Agent Profile Header ===== */}
        <div className="bg-white border border-np-border rounded-xl shadow-[0px_4px_10px_rgba(45,41,38,0.04)] p-6 mb-6">
          <div className="flex items-center justify-between">
            {/* Left: icon + info */}
            <div className="flex items-center gap-5">
              {/* Agent icon */}
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: iconBg }}
              >
                <svg className="w-8 h-8 text-np-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 2C6.48 2 2 6 2 11c0 2.76 1.36 5.22 3.48 6.84L4 22l4.92-2.16C10.16 20.28 11.06 20.5 12 20.5c5.52 0 10-4 10-9S17.52 2 12 2z" />
                </svg>
              </div>
              {/* Name + meta */}
              <div>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData?.name || ''}
                    onChange={(e) => formData && setFormData({ ...formData, name: e.target.value })}
                    className="text-xl font-semibold text-np-text bg-np-input-bg-alt border border-np-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-np-primary"
                  />
                ) : (
                  <h1 className="text-xl font-semibold text-np-text">{agent.name}</h1>
                )}
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-xs text-np-text-muted font-mono">ID: {shortId}</span>
                  <span className="text-np-border">|</span>
                  <span className="text-xs text-np-text-muted">Created {formatDate(agent.createdAt)}</span>
                </div>
              </div>
            </div>

            {/* Right: Status toggle */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-np-text-secondary">Status</span>
              <button
                onClick={handleToggleStatus}
                disabled={togglingStatus}
                className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none ${
                  agent.isActive ? 'bg-emerald-500' : 'bg-np-border'
                } ${togglingStatus ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    agent.isActive ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className={`text-xs font-medium ${agent.isActive ? 'text-emerald-600' : 'text-np-text-muted'}`}>
                {agent.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>

        {/* ===== Bento Grid Layout ===== */}
        <div className="grid grid-cols-3 gap-6">

          {/* ===== Left Column (spans 2 cols) ===== */}
          <div className="col-span-2 space-y-6">

            {/* ---- Core Configuration Card ---- */}
            <div className="bg-white border border-np-border rounded-xl shadow-[0px_4px_10px_rgba(45,41,38,0.04)] p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold text-np-text">Core Configuration</h2>
                {!isEditing && (
                  <button
                    onClick={handleEdit}
                    className="text-xs font-medium text-np-text-muted hover:text-np-primary px-3 py-1.5 rounded-md hover:bg-np-bg-warm transition-colors"
                  >
                    Edit
                  </button>
                )}
              </div>

              <div className="space-y-5">
                {/* Base Model */}
                <div>
                  <label className="block text-xs font-bold text-np-text-secondary tracking-[0.6px] uppercase mb-1.5">Base Model</label>
                  {isEditing ? (
                    <select
                      value={`${formData?.modelConfig.provider}|${formData?.modelConfig.model}`}
                      onChange={(e) => {
                        if (!formData) return;
                        const [provider, model] = e.target.value.split('|');
                        setFormData({
                          ...formData,
                          modelConfig: { ...formData.modelConfig, provider, model },
                        });
                      }}
                      className="w-full bg-np-input-bg-alt border border-np-border rounded-lg px-3 py-2.5 text-sm text-np-text focus:outline-none focus:ring-1 focus:ring-np-primary"
                    >
                      <option value="anthropic|claude-sonnet-4-20250514">Claude Sonnet 4</option>
                      <option value="anthropic|claude-opus-4-20250514">Claude Opus 4</option>
                      <option value="anthropic|claude-haiku-4-20250514">Claude Haiku 4</option>
                      <option value="openai|gpt-4o">GPT-4o</option>
                      <option value="openai|gpt-4o-mini">GPT-4o Mini</option>
                    </select>
                  ) : (
                    <div className="bg-np-input-bg-alt border border-np-border rounded-lg px-3 py-2.5 text-sm text-np-text">
                      {agent.modelConfig.provider === 'anthropic' ? 'Claude' : agent.modelConfig.provider} / {agent.modelConfig.model}
                    </div>
                  )}
                </div>

                {/* Role */}
                <div>
                  <label className="block text-xs font-bold text-np-text-secondary tracking-[0.6px] uppercase mb-1.5">Role</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData?.role || ''}
                      onChange={(e) => formData && setFormData({ ...formData, role: e.target.value })}
                      placeholder="e.g. Financial Advisor, Customer Support Agent"
                      className="w-full bg-np-input-bg-alt border border-np-border rounded-lg px-3 py-2.5 text-sm text-np-text placeholder:text-np-text-placeholder focus:outline-none focus:ring-1 focus:ring-np-primary"
                    />
                  ) : (
                    <div className="bg-np-input-bg-alt border border-np-border rounded-lg px-3 py-2.5 text-sm text-np-text">
                      {agent.description || 'No role defined'}
                    </div>
                  )}
                </div>

                {/* System Prompt */}
                <div>
                  <label className="block text-xs font-bold text-np-text-secondary tracking-[0.6px] uppercase mb-1.5">System Prompt</label>
                  {isEditing ? (
                    <textarea
                      value={formData?.systemPrompt || ''}
                      onChange={(e) => formData && setFormData({ ...formData, systemPrompt: e.target.value })}
                      rows={5}
                      className="w-full bg-np-input-bg-alt border border-np-border rounded-lg px-3 py-2.5 text-sm text-np-text font-mono placeholder:text-np-text-placeholder focus:outline-none focus:ring-1 focus:ring-np-primary resize-none"
                      style={{ minHeight: '128px' }}
                      placeholder="Define the agent's behavior and instructions..."
                    />
                  ) : (
                    <div
                      className="w-full bg-np-input-bg-alt border border-np-border rounded-lg px-3 py-2.5 text-sm text-np-text font-mono whitespace-pre-wrap overflow-auto"
                      style={{ minHeight: '128px', maxHeight: '200px' }}
                    >
                      {agent.systemPrompt || 'No system prompt defined'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ---- Memories Card ---- */}
            <div className="bg-white border border-np-border rounded-xl shadow-[0px_4px_10px_rgba(45,41,38,0.04)] p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base text-np-text">Memories</h2>
                <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-np-text rounded-lg border border-np-border bg-np-accent hover:bg-np-sidebar transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
                    <polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round" />
                    <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round" />
                  </svg>
                  Upload File
                </button>
              </div>

              {/* Files table */}
              <div className="border border-np-border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-np-input-bg-alt border-b border-np-border">
                      <th className="text-left text-xs text-np-text-secondary font-bold px-4 py-3">FILE NAME</th>
                      <th className="text-left text-xs text-np-text-secondary font-bold px-4 py-3">TYPE</th>
                      <th className="text-left text-xs text-np-text-secondary font-bold px-4 py-3">UPLOADED</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockMemories.map((file, idx) => (
                      <tr key={idx} className="border-b border-np-border-light last:border-b-0">
                        <td className="px-4 py-3 text-sm text-np-text">{file.name}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-medium px-2 py-0.5 rounded bg-np-bg-warm text-np-text-secondary">
                            {file.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-np-text-muted">{file.uploadedAt}</td>
                      </tr>
                    ))}
                    {mockMemories.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-sm text-np-text-muted">
                          No files uploaded yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ===== Right Column (1 col) ===== */}
          <div className="col-span-1 space-y-6">

            {/* ---- Cost Control Card ---- */}
            <div className="bg-white border border-np-border rounded-xl shadow-[0px_4px_10px_rgba(45,41,38,0.04)] p-6">
              <h2 className="text-base text-np-text mb-5">Cost Control</h2>

              {/* MTD Token Cost progress */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-np-text-secondary">MTD Token Cost</span>
                  <span className="text-sm font-semibold text-np-text">$12.40</span>
                </div>
                <div className="w-full h-2 bg-np-input-bg-alt rounded-full overflow-hidden">
                  <div
                    className="h-full bg-np-primary rounded-full"
                    style={{ width: '28%' }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-xs text-np-text-muted">28% of $45.00 budget</span>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-np-input-bg-alt border border-np-border rounded-lg p-3">
                  <p className="text-xs text-np-text-muted mb-1">30-Day Sessions</p>
                  <p className="text-lg font-semibold text-np-text">1,284</p>
                </div>
                <div className="bg-np-input-bg-alt border border-np-border rounded-lg p-3">
                  <p className="text-xs text-np-text-muted mb-1">Avg Latency</p>
                  <p className="text-lg font-semibold text-np-text">1.2s</p>
                </div>
              </div>
            </div>

            {/* ---- Assigned Skills Card ---- */}
            <div className="bg-white border border-np-border rounded-xl shadow-[0px_4px_10px_rgba(45,41,38,0.04)] p-6">
              <h2 className="text-base text-np-text mb-5">Assigned Skills</h2>

              {/* Skill items */}
              <div className="space-y-3">
                {agent.skills && agent.skills.length > 0 ? (
                  agent.skills.map((skill) => (
                    <div
                      key={skill.id}
                      className="flex items-start gap-3 p-3 bg-np-input-bg-alt border border-np-border rounded-lg"
                    >
                      {/* Skill icon */}
                      <div className="w-10 h-10 rounded-lg bg-np-accent flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5 text-np-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z" />
                        </svg>
                      </div>
                      {/* Skill info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-np-text">{skill.name}</span>
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                            ACTIVE
                          </span>
                        </div>
                        <p className="text-xs text-np-text-muted mt-0.5 truncate">
                          Skill v{skill.version || '1.0'}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  /* Fallback: use mock skills when agent has no skills */
                  mockSkills.map((skill) => (
                    <div
                      key={skill.id}
                      className="flex items-start gap-3 p-3 bg-np-input-bg-alt border border-np-border rounded-lg"
                    >
                      <div className="w-10 h-10 rounded-lg bg-np-accent flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4 text-np-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-np-text">{skill.name}</span>
                          {skill.isActive && (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-np-text-muted mt-0.5 truncate">
                          {skill.description}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Browse Skill Catalog */}
              <button className="w-full mt-4 border-2 border-dashed border-np-border rounded-lg py-4 text-sm text-np-text-muted hover:text-np-text-secondary hover:border-np-text-muted transition-colors">
                + Browse Skill Catalog
              </button>
            </div>
          </div>
        </div>

        {/* Inline error toast */}
        {error && agent && (
          <div className="fixed bottom-6 right-6 bg-np-red text-white px-5 py-3 rounded-lg shadow-lg text-sm">
            {error}
            <button
              onClick={() => setError('')}
              className="ml-3 underline hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
