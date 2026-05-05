import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useResizableSidebar } from '../hooks/useResizableSidebar';
import {
  listSkills,
  getSkill,
  createSkill,
  updateSkill,
  deleteSkill,
  type Skill,
} from '../api/skills';

export function Skills() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [skills, setSkills] = useState<Skill[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(true);

  const [activeSkill, setActiveSkill] = useState<Skill | null>(null);
  const [activeFile, setActiveFile] = useState<{ name: string; type: string; content: string } | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  const [isEditingSkill, setIsEditingSkill] = useState(false);
  const [skillData, setSkillData] = useState({
    name: '',
    description: '',
    status: 'active' as 'active' | 'draft',
  });

  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteInputText, setDeleteInputText] = useState('');
  const [expectedDeleteCode, setExpectedDeleteCode] = useState('');

  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const { sidebarWidth, isResizing, startResizing } = useResizableSidebar(240, 200, 400);

  // Load skills list
  useEffect(() => {
    let cancelled = false;
    setSkillsLoading(true);

    listSkills()
      .then(res => {
        if (cancelled) return;
        setSkills(res.data);
      })
      .catch(err => {
        console.error('Failed to load skills:', err);
        if (err instanceof Error && err.message.includes('401')) {
          navigate('/login');
        }
      })
      .finally(() => {
        if (!cancelled) setSkillsLoading(false);
      });

    return () => { cancelled = true; };
  }, [navigate]);

  // Load active skill
  useEffect(() => {
    const activeSkillId = id || (skills.length > 0 ? skills[0].id : null);
    if (!activeSkillId) return;

    // If we have a skill ID in params or from list, load it
    const loadSkill = async () => {
      try {
        const skill = await getSkill(activeSkillId);
        setActiveSkill(skill);
        setActiveFile({
          name: 'SKILL.md',
          type: 'file',
          content: skill.content || `# ${skill.name}\n\n${skill.description || 'No description provided.'}`,
        });
        setSkillData({
          name: skill.name,
          description: skill.description || '',
          status: skill.status,
        });
        setIsEditingSkill(false);
        setExpandedFolders({});
      } catch (err) {
        console.error('Failed to load skill:', err);
        if (err instanceof Error && err.message.includes('401')) {
          navigate('/login');
        }
      }
    };

    loadSkill();
  }, [id, skills, navigate]);

  const handleDeleteClick = () => {
    setExpectedDeleteCode(Math.random().toString(36).substring(2, 6).toUpperCase());
    setDeleteInputText('');
    setIsDeleting(true);
  };

  const confirmDelete = async () => {
    if (!activeSkill || deleteInputText.toUpperCase() !== expectedDeleteCode) return;

    try {
      await deleteSkill(activeSkill.id);
      // Navigate to first available skill or to /skills
      const remainingSkills = skills.filter(s => s.id !== activeSkill.id);
      if (remainingSkills.length > 0) {
        navigate(`/skills/${remainingSkills[0].id}`, { replace: true });
      } else {
        navigate('/skills', { replace: true });
      }
    } catch (err) {
      console.error('Failed to delete skill:', err);
      alert('Failed to delete skill');
    }
  };

  const handleSaveSkill = async () => {
    if (!activeSkill) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const updated = await updateSkill(activeSkill.id, skillData);
      setActiveSkill(updated);

      // Update skills list
      setSkills(prev => prev.map(s => s.id === updated.id ? updated : s));

      setIsEditingSkill(false);
    } catch (err) {
      console.error('Failed to update skill:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to save skill');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUploadSkill = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCreating(true);
    setCreateError(null);

    try {
      // Read file content
      const content = await file.text();

      const newSkill = await createSkill({
        name: file.name.replace(/\.[^/.]+$/, ''),
        description: `Uploaded from ${file.name}`,
        content,
        status: 'draft',
      });

      // Navigate to new skill
      navigate(`/skills/${newSkill.id}`);
    } catch (err) {
      console.error('Failed to create skill:', err);
      setCreateError(err instanceof Error ? err.message : 'Failed to upload skill');
    } finally {
      setIsCreating(false);
      // Reset file input
      if (e.target) e.target.value = '';
    }
  };

  const toggleFolder = (folderName: string) => {
    setExpandedFolders(prev => ({ ...prev, [folderName]: !prev[folderName] }));
  };

  const renderTree = () => {
    if (!activeSkill) return null;

    const files = [
      {
        name: 'SKILL.md',
        type: 'file',
        content: activeSkill.content || `# ${activeSkill.name}\n\n${activeSkill.description || 'No description provided.'}`,
      },
    ];

    return files.map((file) => {
      const isSelected = activeFile && activeFile.name === file.name;
      return (
        <button
          key={file.name}
          onClick={() => setActiveFile(file)}
          className={`w-full flex items-center gap-2 px-3 py-1.5 transition-colors text-left text-sm ${isSelected ? 'bg-primary-container/10 text-charcoal font-medium' : 'hover:bg-surface-container text-stone hover:text-charcoal'}`}
          style={{ paddingLeft: '16px' }}
        >
          <span className="material-symbols-outlined text-[18px]">markdown</span>
          <span>{file.name}</span>
        </button>
      );
    });
  };

  return (
    <div className="flex h-full bg-surface-container-low">
      {/* Secondary Drawer (Skills List) */}
      <div
        className="h-full bg-surface-container border-r border-surface-container-highest flex flex-col shrink-0 relative"
        style={{ width: sidebarWidth }}
      >
        <div className="p-6 pb-4 border-b border-surface-container-highest">
          <h2 className="text-[12px] font-bold text-stone mb-3 uppercase tracking-widest">Skills</h2>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-stone text-[18px]">search</span>
            <input className="w-full pl-9 pr-3 py-2 bg-ivory border border-transparent rounded-lg text-sm focus:border-border-cream focus:ring-1 focus:ring-border-cream transition-all placeholder:text-stone/60" placeholder="Search skills..." type="text"/>
          </div>
        </div>

        <div className="flex-grow overflow-y-auto p-3 space-y-1 custom-scrollbar">
          <div className="px-3 py-2 mt-2">
            <span className="text-[10px] font-bold text-stone uppercase tracking-widest">My Skills</span>
          </div>

          {skillsLoading ? (
            <div className="flex items-center justify-center h-32">
              <span className="text-[11px] text-stone">Loading skills...</span>
            </div>
          ) : skills.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <span className="text-[11px] text-stone">No skills found</span>
            </div>
          ) : (
            skills.map(skill => (
              <Link
                key={skill.id}
                to={`/skills/${skill.id}`}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left group ${activeSkill?.id === skill.id ? 'bg-surface-container-high border-border-cream text-charcoal shadow-sm' : 'hover:bg-surface-container-highest border border-transparent text-charcoal'}`}
              >
                <div className="w-8 h-8 rounded-full bg-ivory flex items-center justify-center shrink-0 border border-border-cream">
                  <span className="material-symbols-outlined text-[16px] text-charcoal">extension</span>
                </div>
                <div className="overflow-hidden">
                  <p className={`text-sm truncate ${activeSkill?.id === skill.id ? 'font-semibold' : ''}`}>{skill.name}</p>
                  <p className="text-[11px] text-stone truncate">{skill.status === 'active' ? 'Active' : 'Draft'}</p>
                </div>
              </Link>
            ))
          )}
        </div>

        <div className="mt-auto p-4 border-t border-surface-container-highest">
          {createError && (
            <div className="mb-2 text-xs text-red-600">{createError}</div>
          )}
          <label className={`w-full flex items-center justify-center gap-2 ${isCreating ? 'opacity-70 cursor-not-allowed' : 'bg-primary-container cursor-pointer'} text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-charcoal transition-colors`}>
            <span className="material-symbols-outlined text-[18px]">upload</span>
            {isCreating ? 'Uploading...' : 'Upload Skill'}
            <input type="file" className="hidden" accept=".md,.txt,.js,.ts" onChange={handleUploadSkill} disabled={isCreating} />
          </label>
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
            <Link to="/skills" className="text-stone hover:text-brand transition-colors">Skills</Link>
            <span className="material-symbols-outlined text-stone text-[16px]">chevron_right</span>
            <span className="font-bold text-charcoal">{activeSkill?.name || 'Skills'}</span>
          </div>
        </header>

        {/* Canvas */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar flex flex-col">
          <div className="w-[85%] max-w-[1400px] min-w-[600px] mx-auto flex flex-col gap-6 flex-1 min-h-0">

            {!activeSkill ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <span className="material-symbols-outlined text-[48px] text-stone mb-3">extension</span>
                  <p className="text-sm text-stone">Select a skill or upload a new one</p>
                </div>
              </div>
            ) : (
              <>
                {/* Skill Meta */}
                <div className="flex items-start justify-between bg-ivory p-6 rounded-xl border border-border-cream shadow-whisper">
                  <div className="flex items-start gap-6 flex-1 min-w-0 mr-8">
                    <div className="flex flex-col items-center gap-2 mt-1 shrink-0">
                      <div className="h-16 w-16 rounded-xl bg-surface-container-low flex items-center justify-center border border-border-cream shrink-0">
                        <span className="material-symbols-outlined text-charcoal text-[32px]">extension</span>
                      </div>
                    </div>
                    <div className="flex-1 w-full flex flex-col gap-3 mt-1 min-w-[300px]">
                      {isEditingSkill ? (
                        <>
                          <div>
                            <label className="text-[10px] uppercase tracking-widest font-bold text-stone mb-1 block">Skill Name</label>
                            <input type="text" value={skillData.name} onChange={e => setSkillData({...skillData, name: e.target.value})} className="w-full bg-white border border-border-cream rounded-lg px-3 py-2 text-sm text-charcoal focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all shadow-sm" />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase tracking-widest font-bold text-stone mb-1 block">Description</label>
                            <textarea value={skillData.description} onChange={e => setSkillData({...skillData, description: e.target.value})} rows={2} className="w-full bg-white border border-border-cream rounded-lg px-3 py-2 text-sm text-charcoal focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all shadow-sm resize-none" />
                          </div>
                          {saveError && (
                            <div className="text-xs text-red-600">{saveError}</div>
                          )}
                        </>
                      ) : (
                        <>
                          <h1 className="font-serif text-[28px] text-charcoal leading-tight mb-0">{activeSkill.name}</h1>
                          <p className="text-sm text-stone leading-relaxed">{activeSkill.description || 'No description'}</p>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-3 mt-2">
                    {isEditingSkill ? (
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setIsEditingSkill(false); setSaveError(null); }} className="px-4 py-1.5 rounded-lg text-sm font-semibold text-stone hover:bg-surface-container transition-colors" disabled={isSaving}>
                          Cancel
                        </button>
                        <button onClick={handleSaveSkill} disabled={isSaving} className="flex items-center gap-2 text-sm font-semibold text-white bg-brand hover:bg-brand/90 transition-colors px-4 py-1.5 rounded-lg shadow-sm disabled:opacity-50">
                          {isSaving ? (
                            <>
                              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <span className="material-symbols-outlined text-[18px]">save</span>
                              Save
                            </>
                          )}
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setIsEditingSkill(true)} className="flex items-center gap-2 text-sm font-semibold text-stone hover:text-brand transition-colors px-3 py-1.5 rounded-lg hover:bg-surface-container">
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                        Edit
                      </button>
                    )}
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-stone">Status</span>
                      <label className={`relative inline-flex items-center ${isEditingSkill ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}`}>
                        <input type="checkbox" className="sr-only peer" checked={isEditingSkill ? skillData.status === 'active' : activeSkill.status === 'active'} onChange={e => {
                          if (isEditingSkill) setSkillData({...skillData, status: e.target.checked ? 'active' : 'draft'});
                        }} disabled={!isEditingSkill} />
                        <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container"></div>
                      </label>
                      <span className="font-semibold text-sm text-primary-container w-[50px]">{(isEditingSkill ? skillData.status : activeSkill.status) === 'active' ? 'Active' : 'Draft'}</span>
                    </div>
                  </div>
                </div>

                {/* Skill Resource */}
                <div className="bg-ivory border border-border-cream rounded-xl shadow-whisper overflow-hidden flex flex-col min-h-[500px] flex-1">
                  <div className="p-4 border-b border-border-cream bg-surface-container-low flex items-center justify-between">
                    <h2 className="font-serif text-[20px] text-charcoal">Skill Resources</h2>
                  </div>

                  <div className="flex flex-1 min-h-0 bg-white">
                    {/* File Tree Sidebar */}
                    <div className="w-[260px] border-r border-border-cream bg-surface-lowest overflow-y-auto custom-scrollbar py-3">
                      {renderTree()}
                    </div>

                    {/* Content Viewer pane */}
                    <div className="flex-1 bg-surface-lowest flex flex-col min-w-0">
                      {activeFile ? (
                        <div className="h-full flex flex-col">
                          <div className="px-5 py-3 border-b border-border-cream bg-surface-container-low/30 text-sm font-medium text-charcoal flex items-center gap-2 shrink-0">
                            <span className="material-symbols-outlined text-stone text-[18px]">markdown</span>
                            {activeFile.name}
                          </div>
                          <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                            <pre className="text-sm text-charcoal font-mono whitespace-pre-wrap">
                              {activeFile.content}
                            </pre>
                          </div>
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center text-stone flex-col gap-3">
                          <span className="material-symbols-outlined text-[48px] text-surface-container-highest">description</span>
                          <p className="text-sm">Select a file to view its contents</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Danger Zone */}
                <section className="mt-8 border-t border-border-cream pt-8">
                  <button
                    onClick={handleDeleteClick}
                    className="w-full flex items-center justify-center gap-2 font-semibold text-base text-white bg-red-700 hover:bg-red-800 transition-colors px-6 py-3.5 rounded-xl shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[20px]">delete_forever</span>
                    Delete Skill
                  </button>
                </section>

                {/* Delete Modal */}
                {isDeleting && (
                  <div className="fixed inset-0 bg-charcoal/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsDeleting(false)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-border-cream" onClick={e => e.stopPropagation()}>
                      <div className="p-6 border-b border-border-cream bg-red-50/50">
                        <h3 className="text-xl font-serif text-red-700 flex items-center gap-2">
                          <span className="material-symbols-outlined">warning</span>
                          Delete "{activeSkill.name}"?
                        </h3>
                      </div>
                      <div className="p-6 flex flex-col gap-5">
                        <p className="text-sm text-charcoal leading-relaxed">
                          This action <strong>cannot</strong> be undone. This will permanently delete the <strong>{activeSkill.name}</strong> skill, including all associated resources and files.
                        </p>

                        <div className="bg-surface-container-lowest p-4 rounded-lg border border-border-cream shadow-inner">
                          <label className="text-sm font-semibold text-charcoal">
                            Please type <span className="font-mono bg-red-100 text-red-700 px-1.5 py-0.5 rounded select-all selection:bg-red-200">{expectedDeleteCode}</span> to confirm.
                          </label>
                          <input
                            type="text"
                            value={deleteInputText}
                            onChange={(e) => setDeleteInputText(e.target.value)}
                            className="w-full bg-white border border-border-cream rounded-lg px-4 py-2.5 text-sm font-mono text-charcoal focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all mt-3 text-center tracking-widest uppercase font-bold"
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
                          disabled={deleteInputText.toUpperCase() !== expectedDeleteCode}
                          className="flex items-center gap-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:bg-red-300 disabled:border-red-300 disabled:text-white/70 disabled:cursor-not-allowed transition-colors px-6 py-2.5 rounded-lg shadow-sm border border-red-600"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete_forever</span>
                          I understand, delete this skill
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
