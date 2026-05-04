import { useState } from 'react';
import type { PlanTask } from '../../types/chat';

interface TaskBarProps {
  planTasks: PlanTask[];
}

export function TaskBar({ planTasks }: TaskBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (planTasks.length === 0) return null;

  const completedCount = planTasks.filter(t => t.status === 'completed').length;
  const allCompleted = planTasks.length > 0 && completedCount === planTasks.length;

  // Find the current task to display in collapsed state
  const currentTask = planTasks.find(t => t.status === 'in_progress')
    || planTasks.find(t => t.status === 'pending' && !t.blockedBy.some(id => planTasks.find(p => p.id === id)?.status !== 'completed'))
    || planTasks[planTasks.length - 1];

  return (
    <div className="px-6 pb-1.5 shrink-0 w-full max-w-4xl flex flex-col">
      <div className="bg-ivory border border-border-cream rounded-[10px] overflow-hidden">
        {!isExpanded ? (
          /* === Collapsed: single line === */
          <div
            className="px-3 py-[7px] flex items-center gap-2 cursor-pointer hover:bg-surface-container/50 transition-colors"
            onClick={() => setIsExpanded(true)}
          >
            {/* Status icon */}
            {allCompleted ? (
              <div className="w-[15px] h-[15px] rounded-full bg-success flex items-center justify-center shrink-0">
                <span className="text-white text-[8px] font-bold">✓</span>
              </div>
            ) : currentTask?.status === 'in_progress' ? (
              <div className="w-[15px] h-[15px] rounded-full bg-stone flex items-center justify-center shrink-0">
                <span className="text-white text-[5px] tracking-[1px]">●●●</span>
              </div>
            ) : (
              <div className="w-[15px] h-[15px] rounded-full border-[1.5px] border-stone/40 shrink-0" />
            )}

            {/* Text */}
            <div className="flex-1 min-w-0 flex items-center gap-1.5">
              {allCompleted ? (
                <span className="text-[11px] font-semibold text-success">
                  All {planTasks.length} tasks completed
                </span>
              ) : currentTask ? (
                <>
                  <span className="text-[11px] font-semibold text-charcoal">#{currentTask.id} {currentTask.subject}</span>
                  {currentTask.activeForm && (
                    <span className="text-[10px] text-stone">{currentTask.activeForm}</span>
                  )}
                </>
              ) : null}
            </div>

            {/* Progress */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-stone font-medium">
                {completedCount}/{planTasks.length}
              </span>
              <div className="w-9 h-[3px] bg-surface-container-highest rounded-full overflow-hidden">
                <div
                  className="h-full bg-success rounded-full transition-all duration-500"
                  style={{ width: `${planTasks.length > 0 ? (completedCount / planTasks.length) * 100 : 0}%` }}
                />
              </div>
              <span className="text-stone/40 text-[9px]">▼</span>
            </div>
          </div>
        ) : (
          /* === Expanded: full task list === */
          <>
            {/* Header */}
            <div
              className="px-3 py-[7px] flex items-center gap-1.5 border-b border-border-cream/50 cursor-pointer hover:bg-surface-container/50 transition-colors"
              onClick={() => setIsExpanded(false)}
            >
              <span className="text-[11px] font-semibold text-charcoal">Plan</span>
              <span className={`text-[10px] font-medium ${allCompleted ? 'text-success' : 'text-stone'}`}>
                {allCompleted ? 'All done' : `${completedCount}/${planTasks.length}`}
              </span>
              <div className="flex-1 h-[2px] bg-surface-container-highest rounded-full overflow-hidden">
                <div
                  className="h-full bg-success rounded-full transition-all duration-500"
                  style={{ width: `${planTasks.length > 0 ? (completedCount / planTasks.length) * 100 : 0}%` }}
                />
              </div>
              <span className="text-stone/40 text-[9px]">▼</span>
            </div>

            {/* Task list */}
            <div className="py-1">
              {planTasks.map(task => {
                const isBlocked = task.status === 'pending' && task.blockedBy.some(id =>
                  planTasks.find(t => t.id === id)?.status !== 'completed'
                );

                return (
                  <div
                    key={task.id}
                    className={`flex items-center gap-1.5 px-3 py-[4px] ${
                      task.status === 'in_progress' ? 'bg-white/50' : ''
                    }`}
                  >
                    {/* Status */}
                    {task.status === 'completed' && (
                      <div className="w-[14px] h-[14px] rounded-full bg-success flex items-center justify-center shrink-0">
                        <span className="text-white text-[8px] font-bold">✓</span>
                      </div>
                    )}
                    {task.status === 'in_progress' && (
                      <div className="w-[14px] h-[14px] rounded-full bg-stone flex items-center justify-center shrink-0">
                        <span className="text-white text-[5px]">●●●</span>
                      </div>
                    )}
                    {task.status === 'pending' && isBlocked && (
                      <div className="w-[14px] h-[14px] rounded-full border-[1.5px] border-stone/25 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[8px] text-stone/35">lock</span>
                      </div>
                    )}
                    {task.status === 'pending' && !isBlocked && (
                      <div className="w-[14px] h-[14px] rounded-full border-[1.5px] border-stone/35 shrink-0" />
                    )}

                    {/* Text */}
                    <span className={`text-[11px] ${
                      task.status === 'completed' ? 'text-stone line-through' :
                      task.status === 'in_progress' ? 'font-semibold text-charcoal' :
                      'text-stone'
                    }`}>
                      #{task.id} {task.subject}
                    </span>

                    {/* Active form or blocked label */}
                    {task.status === 'in_progress' && task.activeForm && (
                      <span className="text-[10px] text-stone ml-auto">{task.activeForm}</span>
                    )}
                    {isBlocked && (
                      <span className="text-[9px] text-stone/50 ml-auto">blocked</span>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
