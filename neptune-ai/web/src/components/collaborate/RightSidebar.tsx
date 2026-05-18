import { useState } from 'react';
import type { PlanTask, PlanTodo, MessageBlock } from '../../types/chat';
import type { ArtifactInfo } from '../../hooks/useArtifacts';
import { ArtifactContent } from '../artifact/ArtifactPanel';

interface RightSidebarProps {
  planTasks: PlanTask[];
  planTodos: PlanTodo[];
  artifacts: ArtifactInfo[];
  onCollapse: () => void;
}

/** Format file size for display */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/** Format timestamp for display */
function formatTime(isoStr?: string): string {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${mm}-${dd} ${hh}:${min}`;
}

/** Simple file type label — minimal, gray-black */
function getTypeLabel(fileType: string): string {
  const ft = fileType.toLowerCase();
  if (ft === '.html' || ft === '.htm') return 'HTML';
  if (ft === '.md') return 'MD';
  if (ft === '.py') return 'PY';
  if (ft === '.ts' || ft === '.tsx') return 'TS';
  if (ft === '.js' || ft === '.jsx') return 'JS';
  if (ft === '.json') return 'JSON';
  if (ft === '.csv') return 'CSV';
  if (ft === '.xlsx') return 'XLSX';
  if (ft === '.sql') return 'SQL';
  return ft.replace('.', '').toUpperCase();
}

export function RightSidebar({ planTasks, planTodos, artifacts, onCollapse }: RightSidebarProps) {
  // View state: 'overview' or viewing a specific artifact
  const [activeArtifactId, setActiveArtifactId] = useState<string | null>(null);

  const activeArtifact = artifacts.find(a => a.id === activeArtifactId) || null;

  // Prefer planTasks (richer data from SSE plan_step events), fallback to planTodos (from plan blocks)
  const hasPlanTasks = planTasks.length > 0;
  const hasPlanTodos = planTodos.length > 0;
  const hasTaskData = hasPlanTasks || hasPlanTodos;

  // Compute progress
  const taskItems = hasPlanTasks
    ? planTasks.map(t => ({ content: t.subject, status: t.status }))
    : planTodos.map(t => ({ content: t.content, status: t.status }));
  const completedCount = taskItems.filter(t => t.status === 'completed').length;
  const totalCount = taskItems.length;

  // === Artifact Detail View ===
  if (activeArtifact) {
    const artifactBlock: Extract<MessageBlock, { type: 'artifact' }> = {
      type: 'artifact',
      id: activeArtifact.id,
      title: activeArtifact.title,
      fileType: activeArtifact.fileType,
      content: activeArtifact.content,
    };

    return (
      <aside className="w-[60%] shrink-0 flex flex-col bg-surface-container border-l border-surface-container-highest h-full overflow-hidden">
        {/* Header with back button */}
        <div className="h-16 border-b border-surface-container-highest flex items-center gap-3 px-4 shrink-0">
          <button
            onClick={() => setActiveArtifactId(null)}
            className="p-1.5 text-stone hover:text-charcoal hover:bg-surface-container-highest rounded-lg transition-colors"
            title="返回"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-charcoal truncate">{activeArtifact.title}</p>
            <p className="text-[11px] text-stone">{formatSize(activeArtifact.size)}</p>
          </div>
          <button
            onClick={onCollapse}
            className="p-1.5 text-stone hover:text-charcoal hover:bg-surface-container-highest rounded-lg transition-colors"
            title="收起面板"
          >
            <span className="material-symbols-outlined text-[18px]">right_panel_close</span>
          </button>
        </div>

        {/* Artifact tabs — switch between multiple artifacts */}
        {artifacts.length > 1 && (
          <div className="flex items-center gap-1 px-3 py-2 border-b border-surface-container-highest overflow-x-auto custom-scrollbar">
            {artifacts.map((art) => (
              <button
                key={art.id}
                onClick={() => setActiveArtifactId(art.id)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors ${
                  art.id === activeArtifactId
                    ? 'bg-charcoal/10 text-charcoal'
                    : 'text-stone hover:text-charcoal hover:bg-surface-container-highest'
                }`}
              >
                <span className="italic mr-1 opacity-60">{getTypeLabel(art.fileType)}</span>
                <span className="truncate max-w-[100px] inline-block align-bottom">{art.title.replace(/\.[^.]+$/, '')}</span>
              </button>
            ))}
          </div>
        )}

        {/* Artifact content */}
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
          <ArtifactContent block={artifactBlock} />
        </div>
      </aside>
    );
  }

  // === Overview View ===
  return (
    <aside className="w-[320px] shrink-0 flex flex-col bg-surface-container border-l border-surface-container-highest h-full overflow-hidden">
      {/* Header */}
      <div className="h-16 border-b border-surface-container-highest flex items-center justify-between px-5 shrink-0">
        <span className="text-[13px] font-semibold text-charcoal">详情</span>
        <button
          onClick={onCollapse}
          className="p-1.5 text-stone hover:text-charcoal hover:bg-surface-container-highest rounded-lg transition-colors"
          title="收起面板"
        >
          <span className="material-symbols-outlined text-[18px]">right_panel_close</span>
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Task List Card */}
        {hasTaskData && (
          <div className="p-4 border-b border-surface-container-highest">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[12px] font-bold text-stone uppercase tracking-wider">任务列表</h3>
              <span className="text-[12px] text-stone font-medium">{completedCount}/{totalCount}</span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-1 bg-surface-container-highest rounded-full mb-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${completedCount === totalCount && totalCount > 0 ? 'bg-success' : 'bg-stone/40'}`}
                style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
              />
            </div>

            {/* Task items */}
            <div className="space-y-1">
              {taskItems.map((task, i) => (
                <div key={i} className="flex items-start gap-2 py-1.5 px-1">
                  {task.status === 'completed' && (
                    <span className="w-[16px] h-[16px] rounded-full bg-success/10 flex items-center justify-center shrink-0 mt-0.5">
                      <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5.5L4 7.5L8 3" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                  )}
                  {task.status === 'in_progress' && (
                    <span className="w-[16px] h-[16px] rounded-full border-[1.5px] border-stone/30 border-t-charcoal animate-spin shrink-0 mt-0.5" />
                  )}
                  {task.status === 'pending' && (
                    <span className="w-[16px] h-[16px] rounded-full border-[1.5px] border-stone/20 shrink-0 mt-0.5" />
                  )}
                  <span className={`text-[12px] leading-[1.5] ${
                    task.status === 'completed' ? 'text-stone' :
                    task.status === 'in_progress' ? 'text-charcoal font-medium' :
                    'text-charcoal/70'
                  }`}>
                    {task.content}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Artifacts Card */}
        {artifacts.length > 0 && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[12px] font-bold text-stone uppercase tracking-wider">成果</h3>
              <span className="text-[12px] text-stone">{artifacts.length} 个文件</span>
            </div>

            <div className="space-y-1">
              {artifacts.map((artifact) => (
                <div
                  key={artifact.id}
                  onClick={() => setActiveArtifactId(artifact.id)}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-surface-container-highest/60 cursor-pointer transition-colors"
                >
                  {/* Simple type label */}
                  <span className="text-[11px] font-bold italic text-charcoal/60 w-[36px] shrink-0 text-center border border-charcoal/20 rounded px-1.5 py-0.5">
                    {getTypeLabel(artifact.fileType)}
                  </span>
                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-charcoal font-medium truncate">{artifact.title}</p>
                    <p className="text-[11px] text-stone">
                      {formatSize(artifact.size)}
                      {artifact.createdAt && <span className="ml-2">{formatTime(artifact.createdAt)}</span>}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!hasTaskData && artifacts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <span className="material-symbols-outlined text-[32px] text-stone/30 mb-3">dashboard</span>
            <p className="text-[12px] text-stone/50 text-center">
              发送消息后，任务进度和生成的文件将在此显示
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
