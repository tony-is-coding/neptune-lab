import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createAgent } from "../api/agents";

export function CreateAgent() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    agentName: "",
    description: "",
    baseModel: "GPT-4o",
    systemPrompt: ""
  });

  const [errors, setErrors] = useState({
    agentName: false,
    baseModel: false,
    systemPrompt: false
  });

  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreate = async () => {
    const newErrors = {
      agentName: !formData.agentName.trim(),
      baseModel: !formData.baseModel.trim(),
      systemPrompt: !formData.systemPrompt.trim()
    };

    setErrors(newErrors);

    if (!newErrors.agentName && !newErrors.baseModel && !newErrors.systemPrompt) {
      setIsCreating(true);
      setCreateError(null);

      try {
        const agent = await createAgent({
          name: formData.agentName,
          description: formData.description || undefined,
          systemPrompt: formData.systemPrompt,
          modelConfig: {
            model: formData.baseModel,
          },
        });

        // Navigate to agent config page
        navigate(`/agents/${agent.id}`);
      } catch (err) {
        console.error('Failed to create agent:', err);
        setCreateError(err instanceof Error ? err.message : 'Failed to create agent');
        setIsCreating(false);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface-container-low overflow-y-auto">
      <header className="sticky top-0 w-full h-16 bg-surface-container-low/90 backdrop-blur-md border-b border-surface-container-highest flex items-center px-8 z-30 shrink-0">
        <div className="flex items-center gap-2 text-stone text-sm">
          <Link to="/agents" className="hover:text-brand transition-colors">Agents</Link>
          <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          <span className="font-bold text-charcoal">Create New Agent</span>
        </div>
      </header>

      <div className="flex-1 max-w-5xl w-full mx-auto px-8 pt-10 pb-24">
        <div className="mb-8">
          <h1 className="font-serif text-[40px] text-charcoal">Create New Agent</h1>
          <p className="text-[18px] text-olive mt-2 max-w-2xl">Configure a new specialized AI agent. Define its identity, core model, and provide the necessary tools for its task.</p>
        </div>

        {createError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <span className="material-symbols-outlined text-red-600">error</span>
            <p className="text-sm text-red-700">{createError}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-8 space-y-8">
            {/* Agent Identity */}
            <section className="bg-ivory rounded-xl p-8 border border-border-cream shadow-whisper">
              <h2 className="font-serif text-[24px] text-charcoal mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-stone">badge</span>
                Agent Identity
              </h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-[12px] font-bold tracking-widest uppercase text-stone mb-2" htmlFor="agent-name">Agent Name <span className="text-red-500">*</span></label>
                  <input
                    value={formData.agentName}
                    onChange={(e) => setFormData({...formData, agentName: e.target.value})}
                    className={`w-full bg-white border ${errors.agentName ? 'border-red-500 ring-1 ring-red-500' : 'border-border-cream focus:border-brand focus:ring-brand'} rounded-lg px-4 py-3.5 text-charcoal focus:outline-none focus:ring-1 transition-colors placeholder:text-stone/50`}
                    id="agent-name"
                    placeholder="e.g., Market Researcher"
                    type="text"
                  />
                  {errors.agentName && <p className="text-red-500 text-xs mt-1.5">Agent Name is required</p>}
                </div>
                <div>
                  <label className="block text-[12px] font-bold tracking-widest uppercase text-stone mb-2" htmlFor="agent-desc">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full bg-white border border-border-cream rounded-lg px-4 py-3.5 text-charcoal focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors placeholder:text-stone/50 resize-none h-24"
                    id="agent-desc"
                    placeholder="Briefly describe what this agent does..."
                  ></textarea>
                </div>
              </div>
            </section>

            {/* Model Configuration */}
            <section className="bg-ivory rounded-xl p-8 border border-border-cream shadow-whisper">
              <h2 className="font-serif text-[24px] text-charcoal mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-stone">memory</span>
                Model Configuration
              </h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-[12px] font-bold tracking-widest uppercase text-stone mb-2" htmlFor="base-model">Base Model <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <select
                      value={formData.baseModel}
                      onChange={(e) => setFormData({...formData, baseModel: e.target.value})}
                      className={`w-full bg-white border ${errors.baseModel ? 'border-red-500 ring-1 ring-red-500' : 'border-border-cream focus:border-brand focus:ring-brand'} rounded-lg px-4 py-3.5 appearance-none text-charcoal focus:outline-none focus:ring-1 transition-colors cursor-pointer`}
                      id="base-model"
                    >
                      <option>GPT-4o</option>
                      <option>Claude 3.5 Sonnet</option>
                      <option>Gemini 1.5 Pro</option>
                    </select>
                    <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-stone pointer-events-none">expand_more</span>
                  </div>
                  {errors.baseModel && <p className="text-red-500 text-xs mt-1.5">Base Model is required</p>}
                </div>
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <label className="block text-[12px] font-bold tracking-widest uppercase text-stone" htmlFor="system-prompt">System Prompt <span className="text-red-500">*</span></label>
                    <button className="text-brand font-semibold text-sm hover:underline" type="button">Use Template</button>
                  </div>
                  <textarea
                    value={formData.systemPrompt}
                    onChange={(e) => setFormData({...formData, systemPrompt: e.target.value})}
                    className={`w-full bg-white border ${errors.systemPrompt ? 'border-red-500 ring-1 ring-red-500' : 'border-border-cream focus:border-brand focus:ring-brand'} rounded-lg px-4 py-3.5 text-charcoal focus:outline-none focus:ring-1 transition-colors placeholder:text-stone/50 font-mono text-sm leading-relaxed h-48 custom-scrollbar`}
                    id="system-prompt"
                    placeholder="You are a helpful assistant..."
                  ></textarea>
                  {errors.systemPrompt ? (
                    <p className="text-red-500 text-xs mt-1.5">System Prompt is required</p>
                  ) : (
                    <p className="text-xs text-stone mt-2">Define the core instructions and constraints for the model.</p>
                  )}
                </div>
              </div>
            </section>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-4 space-y-8">
            {/* Tone */}
            <section className="bg-ivory rounded-xl p-6 border border-border-cream shadow-whisper">
              <h2 className="font-serif text-[20px] text-charcoal mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-stone text-lg">mood</span>
                Tone
              </h2>
              <div className="space-y-3">
                <label className="flex items-center justify-between p-3.5 border border-border-cream rounded-lg hover:border-brand focus-within:ring-1 focus-within:ring-brand cursor-pointer transition-colors bg-white">
                  <span className="text-sm font-medium text-charcoal">Concise</span>
                  <input className="text-brand focus:ring-brand h-4 w-4 border-stone" name="tone" type="radio" />
                </label>
                <label className="flex items-center justify-between p-3.5 border border-brand bg-surface-container-lowest rounded-lg cursor-pointer transition-colors shadow-sm ring-1 ring-brand">
                  <span className="text-sm font-medium text-charcoal">Detailed</span>
                  <input defaultChecked className="text-brand focus:ring-brand h-4 w-4 border-stone" name="tone" type="radio" />
                </label>
                <label className="flex items-center justify-between p-3.5 border border-border-cream rounded-lg hover:border-brand focus-within:ring-1 focus-within:ring-brand cursor-pointer transition-colors bg-white">
                  <span className="text-sm font-medium text-charcoal">Enthusiastic</span>
                  <input className="text-brand focus:ring-brand h-4 w-4 border-stone" name="tone" type="radio" />
                </label>
              </div>
            </section>

            {/* Skills */}
            <section className="bg-ivory rounded-xl p-6 border border-border-cream shadow-whisper">
              <h2 className="font-serif text-[20px] text-charcoal mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-stone text-lg">build</span>
                Skills
              </h2>
              <div className="relative mb-4">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-stone text-sm">search</span>
                <input className="w-full pl-9 pr-4 py-2.5 bg-white border border-border-cream rounded-lg text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors" placeholder="Search skills..." type="text" />
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-container transition-colors group cursor-pointer border border-transparent">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-secondary-container flex items-center justify-center text-on-secondary-container">
                      <span className="material-symbols-outlined text-sm">language</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-charcoal leading-tight">Web Search</p>
                      <p className="text-[11px] text-stone">Access current info</p>
                    </div>
                  </div>
                  <button className="text-brand opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="material-symbols-outlined text-sm">add_circle</span>
                  </button>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container border border-border-cream transition-colors group cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-surface-dim flex items-center justify-center text-charcoal">
                      <span className="material-symbols-outlined text-sm">database</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-charcoal leading-tight">Internal Docs</p>
                      <p className="text-[11px] text-stone">Query internal DB</p>
                    </div>
                  </div>
                  <button className="text-error transition-opacity">
                    <span className="material-symbols-outlined text-sm">remove_circle</span>
                  </button>
                </div>
              </div>

              <button className="w-full py-2.5 border border-dashed border-stone rounded-lg text-sm font-medium text-stone hover:border-brand hover:text-brand transition-colors flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-sm">explore</span>
                Browse Hub
              </button>
            </section>
          </div>
        </div>
      </div>

      {/* Sticky Action Bar */}
      <div className="fixed bottom-0 right-0 left-[72px] bg-ivory border-t border-surface-container-highest p-4 px-8 flex justify-end gap-4 z-40 shadow-whisper">
        <button onClick={() => navigate(-1)} className="px-6 py-2.5 rounded-lg font-semibold text-sm text-charcoal hover:bg-surface-container-highest transition-colors">
          Cancel
        </button>
        <button
          onClick={handleCreate}
          disabled={isCreating}
          className="px-6 py-2.5 rounded-lg font-semibold text-sm bg-brand text-white hover:bg-brand/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isCreating ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Creating...
            </>
          ) : (
            'Create Agent'
          )}
        </button>
      </div>
    </div>
  );
}
