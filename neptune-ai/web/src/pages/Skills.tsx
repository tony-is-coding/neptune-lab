import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useResizableSidebar } from '../hooks/useResizableSidebar';
import {
  listSkills,
  getSkill,
  createSkill,
  updateSkill,
  publishSkill,
  unpublishSkill,
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
  const [statusActionError, setStatusActionError] = useState<string | null>(null);
  const [statusAction, setStatusAction] = useState<'publish' | 'unpublish' | null>(null);

  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const { sidebarWidth, isResizing, startResizing } = useResizableSidebar(240, 200, 400);

  // 加载技能目录
  useEffect(() => {
    let cancelled = false;
    setSkillsLoading(true);

    listSkills()
      .then(res => {
        if (cancelled) return;
        setSkills(res.data);
      })
      .catch(err => {
        console.error('加载技能失败:', err);
        if (err instanceof Error && err.message.includes('401')) {
          navigate('/login');
        }
      })
      .finally(() => {
        if (!cancelled) setSkillsLoading(false);
      });

    return () => { cancelled = true; };
  }, [navigate]);

  // 加载当前技能
  useEffect(() => {
    const activeSkillId = id || (skills.length > 0 ? skills[0].id : null);
    if (!activeSkillId) return;

    const loadSkill = async () => {
      try {
        const skill = await getSkill(activeSkillId);
        setActiveSkill(skill);
        setActiveFile({
          name: 'SKILL.md',
          type: 'file',
          content: skill.content || `# ${skill.name}\n\n${skill.description || '暂无描述。'}`,
        });
        setSkillData({
          name: skill.name,
          description: skill.description || '',
          status: skill.status,
        });
        setIsEditingSkill(false);
        setExpandedFolders({});
      } catch (err) {
        console.error('加载技能详情失败:', err);
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
      const remainingSkills = skills.filter(s => s.id !== activeSkill.id);
      if (remainingSkills.length > 0) {
        navigate(`/skills/${remainingSkills[0].id}`, { replace: true });
      } else {
        navigate('/skills', { replace: true });
      }
    } catch (err) {
      console.error('删除技能失败:', err);
      alert('删除技能失败');
    }
  };

  const handleSaveSkill = async () => {
    if (!activeSkill) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const updated = await updateSkill(activeSkill.id, skillData);
      setActiveSkill(updated);

      setSkills(prev => prev.map(s => s.id === updated.id ? updated : s));

      setIsEditingSkill(false);
    } catch (err) {
      console.error('更新技能失败:', err);
      setSaveError(err instanceof Error ? err.message : '保存技能失败');
    } finally {
      setIsSaving(false);
    }
  };

  const applySkillUpdate = (updated: Skill) => {
    setActiveSkill(updated);
    setSkillData({
      name: updated.name,
      description: updated.description || '',
      status: updated.status,
    });
    setSkills(prev => prev.map(s => s.id === updated.id ? updated : s));
  };

  const handlePublishSkill = async () => {
    if (!activeSkill) return;

    setStatusAction('publish');
    setStatusActionError(null);

    try {
      const updated = await publishSkill(activeSkill.id);
      applySkillUpdate(updated);
    } catch (err) {
      console.error('上架技能失败:', err);
      setStatusActionError(err instanceof Error ? err.message : '上架技能失败');
    } finally {
      setStatusAction(null);
    }
  };

  const handleUnpublishSkill = async () => {
    if (!activeSkill) return;

    setStatusAction('unpublish');
    setStatusActionError(null);

    try {
      const updated = await unpublishSkill(activeSkill.id);
      applySkillUpdate(updated);
    } catch (err) {
      console.error('下架技能失败:', err);
      setStatusActionError(err instanceof Error ? err.message : '下架技能失败');
    } finally {
      setStatusAction(null);
    }
  };

  const handleUploadSkill = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCreating(true);
    setCreateError(null);

    try {
      const content = await file.text();

      const newSkill = await createSkill({
        name: file.name.replace(/\.[^/.]+$/, ''),
        description: `从 ${file.name} 上传`,
        content,
        status: 'draft',
      });

      navigate(`/skills/${newSkill.id}`);
    } catch (err) {
      console.error('创建技能失败:', err);
      setCreateError(err instanceof Error ? err.message : '上传技能失败');
    } finally {
      setIsCreating(false);
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
      content: activeSkill.content || `# ${activeSkill.name}\n\n${activeSkill.description || '暂无描述。'}`,
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
      {/* 技能列表 */}
      <div
        className="h-full bg-surface-container border-r border-surface-container-highest flex flex-col shrink-0 relative"
        style={{ width: sidebarWidth }}
      >
        <div className="p-6 pb-4 border-b border-surface-container-highest">
          <h2 className="text-[12px] font-bold text-stone mb-3 tracking-widest">技能目录</h2>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-stone text-[18px]">search</span>
            <input className="w-full pl-9 pr-3 py-2 bg-ivory border border-transparent rounded-lg text-sm focus:border-border-cream focus:ring-1 focus:ring-border-cream transition-all placeholder:text-stone/60" placeholder="搜索技能..." type="text"/>
          </div>
        </div>

        <div className="flex-grow overflow-y-auto p-3 space-y-1 custom-scrollbar">
          <div className="px-3 py-2 mt-2">
            <span className="text-[10px] font-bold text-stone tracking-widest">我的技能</span>
          </div>

          {skillsLoading ? (
            <div className="flex items-center justify-center h-32">
              <span className="text-[11px] text-stone">正在加载技能...</span>
            </div>
          ) : skills.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <span className="text-[11px] text-stone">暂无技能</span>
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
                  <p className="text-[11px] text-stone truncate">{skill.status === 'active' ? '已上架' : '草稿'}</p>
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
            {isCreating ? '正在上传...' : '上传技能'}
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
            <Link to="/skills" className="text-stone hover:text-brand transition-colors">技能目录</Link>
            <span className="material-symbols-outlined text-stone text-[16px]">chevron_right</span>
            <span className="font-bold text-charcoal">{activeSkill?.name || '技能目录'}</span>
          </div>
        </header>

        {/* Canvas */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar flex flex-col">
          <div className="w-[85%] max-w-[1400px] min-w-[600px] mx-auto flex flex-col gap-6 flex-1 min-h-0">

            {!activeSkill ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <span className="material-symbols-outlined text-[48px] text-stone mb-3">extension</span>
                  <p className="text-sm text-stone">选择一个技能，或上传新的技能文件</p>
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
                            <label className="text-[10px] tracking-widest font-bold text-stone mb-1 block">技能名称</label>
                            <input type="text" value={skillData.name} onChange={e => setSkillData({...skillData, name: e.target.value})} className="w-full bg-ivory border border-border-cream rounded-lg px-3 py-2 text-sm text-charcoal focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all shadow-sm" />
                          </div>
                          <div>
                            <label className="text-[10px] tracking-widest font-bold text-stone mb-1 block">描述</label>
                            <textarea value={skillData.description} onChange={e => setSkillData({...skillData, description: e.target.value})} rows={2} className="w-full bg-ivory border border-border-cream rounded-lg px-3 py-2 text-sm text-charcoal focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all shadow-sm resize-none" />
                          </div>
                          {saveError && (
                            <div className="text-xs text-error">{saveError}</div>
                          )}
                        </>
                      ) : (
                        <>
                          <h1 className="font-serif text-[28px] text-charcoal leading-tight mb-0">{activeSkill.name}</h1>
                          <p className="text-sm text-stone leading-relaxed">{activeSkill.description || '暂无描述'}</p>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-3 mt-2">
                    {isEditingSkill ? (
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setIsEditingSkill(false); setSaveError(null); }} className="px-4 py-1.5 rounded-lg text-sm font-semibold text-stone hover:bg-surface-container transition-colors" disabled={isSaving}>
                          取消
                        </button>
                        <button onClick={handleSaveSkill} disabled={isSaving} className="flex items-center gap-2 text-sm font-semibold text-white bg-brand hover:bg-brand/90 transition-colors px-4 py-1.5 rounded-lg shadow-sm disabled:opacity-50">
                          {isSaving ? (
                            <>
                              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              正在保存...
                            </>
                          ) : (
                            <>
                              <span className="material-symbols-outlined text-[18px]">save</span>
                              保存
                            </>
                          )}
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setIsEditingSkill(true)} className="flex items-center gap-2 text-sm font-semibold text-stone hover:text-brand transition-colors px-3 py-1.5 rounded-lg hover:bg-surface-container">
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                        编辑
                      </button>
                    )}
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-stone">状态</span>
                      <label className={`relative inline-flex items-center ${isEditingSkill ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}`}>
                        <input type="checkbox" className="sr-only peer" checked={isEditingSkill ? skillData.status === 'active' : activeSkill.status === 'active'} onChange={e => {
                          if (isEditingSkill) setSkillData({...skillData, status: e.target.checked ? 'active' : 'draft'});
                        }} disabled={!isEditingSkill} />
                        <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container"></div>
                      </label>
                      <span className="font-semibold text-sm text-primary-container w-[56px]">{(isEditingSkill ? skillData.status : activeSkill.status) === 'active' ? '已上架' : '草稿'}</span>
                    </div>
                    {!isEditingSkill && (
                      <div className="flex flex-col items-end gap-2">
                        {activeSkill.status === 'draft' ? (
                          <button
                            onClick={handlePublishSkill}
                            disabled={statusAction !== null}
                            className="flex items-center gap-2 text-sm font-semibold text-white bg-brand hover:bg-brand/90 transition-colors px-4 py-2 rounded-lg shadow-sm disabled:opacity-60"
                          >
                            {statusAction === 'publish' ? (
                              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <span className="material-symbols-outlined text-[18px]">publish</span>
                            )}
                            上架技能
                          </button>
                        ) : (
                          <button
                            onClick={handleUnpublishSkill}
                            disabled={statusAction !== null}
                            className="flex items-center gap-2 text-sm font-semibold text-charcoal bg-surface-container-highest hover:bg-surface-container transition-colors px-4 py-2 rounded-lg border border-border-cream disabled:opacity-60"
                          >
                            {statusAction === 'unpublish' ? (
                              <span className="w-4 h-4 border-2 border-stone/30 border-t-charcoal rounded-full animate-spin" />
                            ) : (
                              <span className="material-symbols-outlined text-[18px]">unpublished</span>
                            )}
                            下架为草稿
                          </button>
                        )}
                        {statusActionError && (
                          <p className="text-xs text-error max-w-[220px] text-right">{statusActionError}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* 技能资源 */}
                <div className="bg-ivory border border-border-cream rounded-xl shadow-whisper overflow-hidden flex flex-col min-h-[500px] flex-1">
                  <div className="p-4 border-b border-border-cream bg-surface-container-low flex items-center justify-between">
                    <h2 className="font-serif text-[20px] text-charcoal">技能资源</h2>
                  </div>

                  <div className="flex flex-1 min-h-0 bg-ivory">
                    {/* 文件树 */}
                    <div className="w-[260px] border-r border-border-cream bg-surface-lowest overflow-y-auto custom-scrollbar py-3">
                      {renderTree()}
                    </div>

                    {/* 内容查看区 */}
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
                          <p className="text-sm">选择一个文件查看内容</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Danger Zone */}
                <section className="mt-8 border-t border-border-cream pt-8">
                  <button
                    onClick={handleDeleteClick}
                    className="w-full flex items-center justify-center gap-2 font-semibold text-base text-error bg-ivory hover:bg-surface-container-low transition-colors px-6 py-3.5 rounded-xl border border-border-cream shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[20px]">delete_forever</span>
                    删除技能
                  </button>
                </section>

                {/* Delete Modal */}
                {isDeleting && (
                  <div className="fixed inset-0 bg-charcoal/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsDeleting(false)}>
                    <div className="bg-ivory rounded-xl shadow-whisper w-full max-w-lg overflow-hidden border border-border-cream" onClick={e => e.stopPropagation()}>
                      <div className="p-6 border-b border-border-cream bg-surface-container-low">
                        <h3 className="text-xl font-serif text-error flex items-center gap-2">
                          <span className="material-symbols-outlined">warning</span>
                          删除“{activeSkill.name}”？
                        </h3>
                      </div>
                      <div className="p-6 flex flex-col gap-5">
                        <p className="text-sm text-charcoal leading-relaxed">
                          此操作<strong>无法撤销</strong>。系统会永久删除 <strong>{activeSkill.name}</strong> 技能及其关联资源。
                        </p>

                        <div className="bg-surface-container-lowest p-4 rounded-lg border border-border-cream shadow-inner">
                          <label className="text-sm font-semibold text-charcoal">
                            请输入 <span className="font-mono bg-surface-container text-error px-1.5 py-0.5 rounded select-all">{expectedDeleteCode}</span> 确认删除。
                          </label>
                          <input
                            type="text"
                            value={deleteInputText}
                            onChange={(e) => setDeleteInputText(e.target.value)}
                            className="w-full bg-ivory border border-border-cream rounded-lg px-4 py-2.5 text-sm font-mono text-charcoal focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all mt-3 text-center tracking-widest uppercase font-bold"
                            placeholder={expectedDeleteCode}
                          />
                        </div>
                      </div>
                      <div className="p-5 border-t border-border-cream bg-surface-container-lowest flex justify-end gap-3 rounded-b-xl border-t-0 p-t-4">
                        <button
                          onClick={() => setIsDeleting(false)}
                          className="px-5 py-2.5 rounded-lg text-sm font-semibold text-stone hover:bg-surface-container-highest transition-colors"
                        >
                          取消
                        </button>
                        <button
                          onClick={confirmDelete}
                          disabled={deleteInputText.toUpperCase() !== expectedDeleteCode}
                          className="flex items-center gap-2 text-sm font-semibold text-white bg-error hover:bg-error/90 disabled:bg-surface-container-highest disabled:border-border-cream disabled:text-stone disabled:cursor-not-allowed transition-colors px-6 py-2.5 rounded-lg shadow-sm border border-error"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete_forever</span>
                          确认删除技能
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
