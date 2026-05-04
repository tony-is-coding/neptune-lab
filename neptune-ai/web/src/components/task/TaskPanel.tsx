import type { PlanTask, BackgroundTask } from '../../types/chat';
import { PlanTaskItem } from './PlanTaskItem';
import { BackgroundTaskItem } from './BackgroundTaskItem';

interface TaskPanelProps {
  planTasks: PlanTask[];
  backgroundTasks: BackgroundTask[];
}

export function TaskPanel({ planTasks, backgroundTasks }: TaskPanelProps) {
  const completedCount = planTasks.filter(t => t.status === 'completed').length;
  const runningCount = planTasks.filter(t => t.status === 'in_progress').length;
  const allCompleted = planTasks.length > 0 && completedCount === planTasks.length;
  const bgRunningCount = backgroundTasks.filter(t => t.status === 'running').length;

  return (
    <section className="w-[320px] shrink-0 flex flex-col bg-surface-container border-l border-surface-container-highest relative z-40 transition-all duration-300 shadow-sm">
      {/* Header */}
      <div className="h-16 border-b border-surface-container-highest flex items-center justify-between px-6 bg-surface-container w-full shrink-0">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-stone">checklist</span>
          <span className="text-[16px] font-semibold text-charcoal">Tasks</span>
        </div>
        <div className="flex items-center gap-2">
          {runningCount > 0 && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-stone/10 text-stone font-medium">
              {runningCount} running
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Execution Plan */}
        {planTasks.length > 0 && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-stone uppercase tracking-widest">
                Execution Plan
              </h3>
              <span className={`text-[11px] font-medium ${
                allCompleted ? 'text-success' : 'text-stone'
              }`}>
                {allCompleted ? 'All done ✓' : `${completedCount}/${planTasks.length}`}
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-1 bg-surface-container-highest rounded-full mb-4 overflow-hidden">
              <div
                className="h-full bg-success rounded-full transition-all duration-500"
                style={{ width: `${planTasks.length > 0 ? (completedCount / planTasks.length) * 100 : 0}%` }}
              />
            </div>

            <div className="space-y-1">
              {planTasks.map(task => (
                <PlanTaskItem key={task.id} task={task} allTasks={planTasks} />
              ))}
            </div>
          </div>
        )}

        {/* Background Activity */}
        {backgroundTasks.length > 0 && (
          <div className="p-4 border-t border-surface-container-highest">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-stone uppercase tracking-widest">
                Background Activity
              </h3>
              {bgRunningCount > 0 && (
                <span className="text-[11px] text-stone">{bgRunningCount} active</span>
              )}
            </div>
            <div className="space-y-1">
              {backgroundTasks.map(task => (
                <BackgroundTaskItem key={task.id} task={task} />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {planTasks.length === 0 && backgroundTasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <span className="material-symbols-outlined text-[32px] text-stone/30 mb-3">checklist</span>
            <p className="text-[13px] text-stone/50 text-center">
              No active tasks. Send a message to start working.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
