import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';

interface Skill {
  id: string;
  name: string;
  icon: string;
}

const PRESET_SKILLS: Skill[] = [
  { id: 'web-search', name: 'Web Search', icon: 'search' },
  { id: 'code-gen', name: 'Code Generation', icon: 'code' },
  { id: 'data-analysis', name: 'Data Analysis', icon: 'chart' },
  { id: 'file-ops', name: 'File Operations', icon: 'file' },
  { id: 'api-calls', name: 'API Calls', icon: 'api' },
  { id: 'summarization', name: 'Summarization', icon: 'doc' },
];

const MODEL_OPTIONS = [
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  { value: 'claude-3-opus', label: 'Claude 3 Opus' },
  { value: 'claude-3-sonnet', label: 'Claude 3 Sonnet' },
];

const TONE_OPTIONS = [
  { value: 'concise', label: 'Concise' },
  { value: 'detailed', label: 'Detailed' },
  { value: 'enthusiastic', label: 'Enthusiastic' },
];

function SkillIcon({ type }: { type: string }) {
  const iconClass = 'w-4 h-4';
  switch (type) {
    case 'search':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
        </svg>
      );
    case 'code':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'chart':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M18 20V10M12 20V4M6 20v-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'file':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'api':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'doc':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <path d="M14 2v6h6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M16 13H8M16 17H8M10 9H8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
  }
}

export function CreateAgent() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    baseModel: 'gpt-4o',
    systemPrompt: '',
    tone: 'detailed',
    selectedSkills: ['web-search', 'data-analysis'] as string[],
  });

  const [skillSearch, setSkillSearch] = useState('');

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleSkill = (skillId: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedSkills: prev.selectedSkills.includes(skillId)
        ? prev.selectedSkills.filter((id) => id !== skillId)
        : [...prev.selectedSkills, skillId],
    }));
  };

  const filteredSkills = PRESET_SKILLS.filter((skill) =>
    skill.name.toLowerCase().includes(skillSearch.toLowerCase())
  );

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setError('Agent name is required');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      await apiClient.createAgent({
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        systemPrompt: formData.systemPrompt.trim() || 'You are a helpful assistant.',
        modelConfig: {
          provider: formData.baseModel.startsWith('gpt') ? 'openai' : 'anthropic',
          model: formData.baseModel,
          temperature: 0.7,
          maxTokens: 4096,
        },
        skills: formData.selectedSkills.map((id) => {
          const skill = PRESET_SKILLS.find((s) => s.id === id);
          return { id, name: skill?.name || id };
        }),
        tools: formData.selectedSkills,
      });

      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create agent');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Main Content Area */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-[1200px] mx-auto px-10 py-8 pb-32">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 mb-6">
            <button
              onClick={() => navigate('/')}
              className="text-sm text-np-text-muted hover:text-np-primary transition-colors"
            >
              Agents
            </button>
            <svg className="w-4 h-4 text-np-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-sm text-np-text-secondary font-medium">Create New Agent</span>
          </nav>

          {/* Title */}
          <div className="mb-8">
            <h1 className="text-[40px] font-bold text-np-primary tracking-tight mb-2">
              Create New Agent
            </h1>
            <p className="text-base text-np-text-secondary">
              Configure a new specialized AI agent tailored to your specific needs and workflows.
            </p>
          </div>

          {/* Form Grid */}
          <div className="grid grid-cols-12 gap-6">
            {/* Left Column - 8 cols */}
            <div className="col-span-8 space-y-6">
              {/* Agent Identity Card */}
              <div className="bg-white border border-np-border-card rounded-xl shadow-[0px_4px_10px_rgba(45,41,38,0.04)] p-[33px]">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-np-accent flex items-center justify-center">
                    <svg className="w-4 h-4 text-np-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-semibold text-np-primary">Agent Identity</h2>
                </div>

                {/* Agent Name */}
                <div className="mb-5">
                  <label className="block text-xs font-bold text-np-text-secondary tracking-[0.6px] uppercase mb-2">
                    Agent Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    placeholder="e.g., Market Researcher"
                    className="w-full px-4 py-3 bg-np-input-bg border border-np-border-light rounded-lg text-sm text-np-text placeholder:text-np-text-placeholder focus:outline-none focus:ring-2 focus:ring-np-primary/20 focus:border-np-primary transition-colors"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-np-text-secondary tracking-[0.6px] uppercase mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => updateField('description', e.target.value)}
                    placeholder="Briefly describe what this agent does..."
                    rows={3}
                    className="w-full px-4 py-3 bg-np-input-bg border border-np-border-light rounded-lg text-sm text-np-text placeholder:text-np-text-placeholder focus:outline-none focus:ring-2 focus:ring-np-primary/20 focus:border-np-primary transition-colors resize-none"
                  />
                </div>
              </div>

              {/* Model Configuration Card */}
              <div className="bg-white border border-np-border-card rounded-xl shadow-[0px_4px_10px_rgba(45,41,38,0.04)] p-[33px]">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-emerald-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M12 2C6.48 2 2 6 2 11c0 2.76 1.36 5.22 3.48 6.84L4 22l4.92-2.16C10.16 20.28 11.06 20.5 12 20.5c5.52 0 10-4 10-9S17.52 2 12 2z" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-semibold text-np-primary">Model Configuration</h2>
                </div>

                {/* Base Model */}
                <div className="mb-5">
                  <label className="block text-xs font-bold text-np-text-secondary tracking-[0.6px] uppercase mb-2">
                    Base Model
                  </label>
                  <select
                    value={formData.baseModel}
                    onChange={(e) => updateField('baseModel', e.target.value)}
                    className="w-full px-4 py-3 bg-np-input-bg border border-np-border-light rounded-lg text-sm text-np-text focus:outline-none focus:ring-2 focus:ring-np-primary/20 focus:border-np-primary transition-colors appearance-none cursor-pointer"
                  >
                    {MODEL_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* System Prompt */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-np-text-secondary tracking-[0.6px] uppercase">
                      System Prompt
                    </label>
                    <button
                      type="button"
                      className="text-xs font-medium text-np-text-muted hover:text-np-primary transition-colors px-3 py-1.5 rounded-md hover:bg-np-bg-warm"
                    >
                      Use Template
                    </button>
                  </div>
                  <textarea
                    value={formData.systemPrompt}
                    onChange={(e) => updateField('systemPrompt', e.target.value)}
                    placeholder="You are a helpful assistant..."
                    rows={8}
                    className="w-full px-4 py-3 bg-np-input-bg border border-np-border-light rounded-lg text-sm text-np-text placeholder:text-np-text-placeholder focus:outline-none focus:ring-2 focus:ring-np-primary/20 focus:border-np-primary transition-colors resize-none font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Right Column - 4 cols */}
            <div className="col-span-4 space-y-6">
              {/* Personality & Tone Card */}
              <div className="bg-white border border-np-border-card rounded-xl shadow-[0px_4px_10px_rgba(45,41,38,0.04)] p-[33px]">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-purple-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-semibold text-np-primary">Personality & Tone</h2>
                </div>

                <div className="space-y-2">
                  {TONE_OPTIONS.map((option) => {
                    const isSelected = formData.tone === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updateField('tone', option.value)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors ${
                          isSelected
                            ? 'bg-np-bg-warm border-np-primary'
                            : 'bg-np-input-bg border-np-border-light hover:border-np-border'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            isSelected ? 'border-np-primary' : 'border-np-border-light'
                          }`}
                        >
                          {isSelected && <div className="w-2 h-2 rounded-full bg-np-primary" />}
                        </div>
                        <span className={`text-sm font-medium ${isSelected ? 'text-np-primary' : 'text-np-text-secondary'}`}>
                          {option.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Skills & Tools Card */}
              <div className="bg-white border border-np-border-card rounded-xl shadow-[0px_4px_10px_rgba(45,41,38,0.04)] p-[33px]">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-amber-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-semibold text-np-primary">Skills & Tools</h2>
                </div>

                {/* Search */}
                <div className="relative mb-4">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-np-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
                  </svg>
                  <input
                    type="text"
                    value={skillSearch}
                    onChange={(e) => setSkillSearch(e.target.value)}
                    placeholder="Search skills..."
                    className="w-full pl-9 pr-4 py-2.5 bg-np-input-bg border border-np-border-light rounded-lg text-sm text-np-text placeholder:text-np-text-placeholder focus:outline-none focus:ring-2 focus:ring-np-primary/20 focus:border-np-primary transition-colors"
                  />
                </div>

                {/* Skills List */}
                <div className="space-y-1 mb-4">
                  {filteredSkills.map((skill) => {
                    const isSelected = formData.selectedSkills.includes(skill.id);
                    return (
                      <div
                        key={skill.id}
                        onClick={() => toggleSkill(skill.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#f7f3f1] text-np-primary'
                            : 'text-np-text-secondary hover:bg-np-input-bg'
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-np-accent' : 'bg-np-border-light'
                        }`}>
                          <SkillIcon type={skill.icon} />
                        </div>
                        <span className="flex-1 text-sm font-medium">{skill.name}</span>
                        {isSelected && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleSkill(skill.id); }}
                            className="w-5 h-5 rounded-full flex items-center justify-center text-np-text-muted hover:text-np-red hover:bg-red-50 transition-colors shrink-0"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Browse Hub */}
                <button
                  type="button"
                  className="w-full py-3 border-2 border-dashed border-np-border rounded-lg text-sm font-medium text-np-text-muted hover:text-np-primary hover:border-np-primary transition-colors"
                >
                  Browse Hub
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="sticky bottom-0 bg-white border-t border-np-border-card px-10 py-4">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between">
          {error && (
            <p className="text-sm text-np-red">{error}</p>
          )}
          {!error && <div />}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-6 py-2.5 rounded-lg text-sm font-medium text-np-text-secondary hover:bg-np-input-bg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !formData.name.trim()}
              className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed ${
                formData.name.trim() && !submitting
                  ? 'bg-np-terracotta text-white hover:bg-np-coral'
                  : 'bg-np-terracotta text-np-text-btn-disabled opacity-60'
              }`}
            >
              {submitting ? 'Creating...' : 'Create Agent'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
