import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useResizableSidebar } from '../hooks/useResizableSidebar';

const MOCK_FILE_TREE = [
  {
    name: 'SKILL.md', type: 'file', content: `# Document Summarizer\n\nThis skill extracts key information from uploaded documents.\n\n## Instructions\n- Pass the document content to the model.\n- Request key bullet points.\n- Format as Markdown.`
  },
  {
    name: 'package.json', type: 'file', content: `{\n  "name": "document-summarizer",\n  "version": "1.0.0",\n  "dependencies": {\n    "pdf-parse": "^1.1.1"\n  }\n}`
  },
  {
    name: 'src', type: 'folder', children: [
      { name: 'index.js', type: 'file', content: `export async function summarize(text) {\n  // Implementation details\n  console.log("Summarizing text...");\n}` },
      { name: 'utils.js', type: 'file', content: `export function parseFile() {\n  return "parsed content";\n}` },
    ]
  }
];

export function Skills() {
  const [skills, setSkills] = useState([
    { id: '1', name: 'Document Summarizer', description: 'Automatically extract key points and action items from lengthy PDFs and text.', active: true },
    { id: '2', name: 'Python Code Reviewer', description: 'Analyze Python scripts for performance, security, and PEP 8 compliance.', active: false },
    { id: '3', name: 'SQL Query Optimizer', description: 'Suggests indexes and rewrites complex SQL queries for faster execution times.', active: true },
  ]);

  const [activeSkillId, setActiveSkillId] = useState('1');
  const [activeFile, setActiveFile] = useState<any>(MOCK_FILE_TREE[0]);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({'/src': true});
  
  const activeSkill = skills.find(s => s.id === activeSkillId) || skills[0] || {
    id: 'empty',
    name: 'No skills found',
    description: '',
    active: false
  };

  const [isEditingSkill, setIsEditingSkill] = useState(false);
  const [skillData, setSkillData] = useState({
    name: activeSkill.name,
    description: activeSkill.description,
    active: activeSkill.active
  });

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
      setSkills(prev => prev.filter(s => s.id !== activeSkillId));
      setIsDeleting(false);
      setActiveSkillId("1");
    }
  };

  useEffect(() => {
    setActiveFile(MOCK_FILE_TREE[0]);
    setExpandedFolders({'/src': true});
    setIsEditingSkill(false);
  }, [activeSkillId]);

  useEffect(() => {
    setSkillData({
      name: activeSkill.name,
      description: activeSkill.description,
      active: activeSkill.active
    });
  }, [activeSkill]);

  const { sidebarWidth, isResizing, startResizing } = useResizableSidebar(240, 200, 400);

  const toggleFolder = (folderName: string) => {
    setExpandedFolders(prev => ({ ...prev, [folderName]: !prev[folderName] }));
  };

  const handleUploadSkill = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const newSkill = {
        id: Date.now().toString(),
        name: file.name.replace(/\.[^/.]+$/, ""),
        description: "Newly uploaded skill package.",
        active: false
      };
      setSkills(prev => [...prev, newSkill]);
      setActiveSkillId(newSkill.id);
    }
  };

  const handleSaveSkill = () => {
    setSkills(prev => prev.map(s => s.id === activeSkillId ? { ...s, ...skillData } : s));
    setIsEditingSkill(false);
  };

  const renderTree = (items: any[], depth = 0, pathPrefix = '') => {
    return items.map((item) => {
      const fullPath = `${pathPrefix}/${item.name}`;
      if (item.type === 'folder') {
        const isExpanded = expandedFolders[fullPath];
        return (
          <div key={fullPath}>
            <button 
              onClick={() => toggleFolder(fullPath)}
              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-surface-container transition-colors text-left text-sm text-charcoal font-medium"
              style={{ paddingLeft: `${depth * 16 + 16}px` }}
            >
              <span className="material-symbols-outlined text-[18px] text-stone">
                {isExpanded ? 'folder_open' : 'folder'}
              </span>
              <span>{item.name}</span>
            </button>
            {isExpanded && item.children && (
              <div>{renderTree(item.children, depth + 1, fullPath)}</div>
            )}
          </div>
        );
      } else {
        const isSelected = activeFile && activeFile.name === item.name;
        return (
          <button 
            key={fullPath}
            onClick={() => setActiveFile(item)}
            className={`w-full flex items-center gap-2 px-3 py-1.5 transition-colors text-left text-sm ${isSelected ? 'bg-primary-container/10 text-charcoal font-medium' : 'hover:bg-surface-container text-stone hover:text-charcoal'}`}
            style={{ paddingLeft: `${depth * 16 + 16}px` }}
          >
            <span className="material-symbols-outlined text-[18px]">
              {item.name.endsWith('.md') ? 'markdown' : item.name.endsWith('.js') ? 'javascript' : 'description'}
            </span>
            <span>{item.name}</span>
          </button>
        );
      }
    });
  };

  return (
    <div className="flex h-full bg-parchment">
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
          
          {skills.map(skill => (
            <button 
              key={skill.id}
              onClick={() => setActiveSkillId(skill.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left group ${skill.id === activeSkillId ? 'bg-surface-container-high border-border-cream text-charcoal shadow-sm' : 'hover:bg-surface-container-highest border border-transparent text-charcoal'}`}
            >
              <div className="w-8 h-8 rounded-full bg-ivory flex items-center justify-center shrink-0 border border-border-cream">
                <span className="material-symbols-outlined text-[16px] text-charcoal">extension</span>
              </div>
              <div className="overflow-hidden">
                <p className={`text-sm truncate ${skill.id === activeSkillId ? 'font-semibold' : ''}`}>{skill.name}</p>
                <p className="text-[11px] text-stone truncate">{skill.active ? 'Active' : 'Inactive'}</p>
              </div>
            </button>
          ))}
        </div>
        
        <div className="mt-auto p-4 border-t border-surface-container-highest">
          <label className="w-full flex items-center justify-center gap-2 bg-primary-container cursor-pointer text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-charcoal transition-colors">
            <span className="material-symbols-outlined text-[18px]">upload</span>
            Upload Skill
            <input type="file" className="hidden" accept=".zip,.tar.gz" onChange={handleUploadSkill} />
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
            <span className="font-bold text-charcoal">{activeSkill.name}</span>
          </div>
        </header>

        {/* Canvas */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar flex flex-col">
          <div className="w-[85%] max-w-[1400px] min-w-[600px] mx-auto flex flex-col gap-6 flex-1 min-h-0">
            
            {/* Skill Meta */}
            <div className="flex items-start justify-between bg-ivory p-6 rounded-xl border border-border-cream shadow-whisper">
              <div className="flex items-start gap-6 flex-1 min-w-0 mr-8">
                <div className="flex flex-col items-center gap-2 mt-1 shrink-0">
                  <div className="h-16 w-16 rounded-xl bg-surface-container-low flex items-center justify-center border border-border-cream shrink-0">
                    <span className="material-symbols-outlined text-charcoal text-[32px]">extension</span>
                  </div>
                  {isEditingSkill && <button className="text-[10px] uppercase tracking-wider font-semibold text-stone hover:text-charcoal transition-colors">Change</button>}
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
                    </>
                  ) : (
                    <>
                      <h1 className="font-serif text-[28px] text-charcoal leading-tight mb-0">{activeSkill.name}</h1>
                      <p className="text-sm text-stone leading-relaxed">{activeSkill.description}</p>
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-3 mt-2">
                {isEditingSkill ? (
                  <div className="flex items-center gap-2">
                    <button onClick={() => setIsEditingSkill(false)} className="px-4 py-1.5 rounded-lg text-sm font-semibold text-stone hover:bg-surface-container transition-colors">
                      Cancel
                    </button>
                    <button onClick={handleSaveSkill} className="flex items-center gap-2 text-sm font-semibold text-white bg-brand hover:bg-brand/90 transition-colors px-4 py-1.5 rounded-lg shadow-sm">
                      <span className="material-symbols-outlined text-[18px]">save</span>
                      Save
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
                    <input type="checkbox" className="sr-only peer" checked={isEditingSkill ? skillData.active : activeSkill.active} onChange={e => {
                      if (isEditingSkill) setSkillData({...skillData, active: e.target.checked});
                    }} disabled={!isEditingSkill} />
                    <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container"></div>
                  </label>
                  <span className="font-semibold text-sm text-primary-container w-[50px]">{(isEditingSkill ? skillData.active : activeSkill.active) ? 'Active' : 'Off'}</span>
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
                  {renderTree(MOCK_FILE_TREE)}
                </div>
                
                {/* Content Viewer pane */}
                <div className="flex-1 bg-surface-lowest flex flex-col min-w-0">
                  {activeFile ? (
                    <div className="h-full flex flex-col">
                      <div className="px-5 py-3 border-b border-border-cream bg-surface-container-low/30 text-sm font-medium text-charcoal flex items-center gap-2 shrink-0">
                        <span className="material-symbols-outlined text-stone text-[18px]">
                          {activeFile.name.endsWith('.md') ? 'markdown' : activeFile.name.endsWith('.js') ? 'javascript' : 'description'}
                        </span>
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

          </div>
        </div>
      </div>
    </div>
  );
}
