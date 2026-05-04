import type { BackgroundTask } from '../../types/chat';

interface BackgroundTaskItemProps {
  task: BackgroundTask;
}

const TYPE_LABELS: Record<BackgroundTask['type'], string> = {
  local_bash: 'Shell',
  local_agent: 'Agent',
  remote_agent: 'Remote Agent',
  local_workflow: 'Workflow',
};

const TYPE_ICONS: Record<BackgroundTask['type'], string> = {
  local_bash: 'terminal',
  local_agent: 'smart_toy',
  remote_agent: 'cloud',
  local_workflow: 'account_tree',
};

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

export function BackgroundTaskItem({ task }: BackgroundTaskItemProps) {
  const isRunning = task.status === 'running';
  const isCompleted = task.status === 'completed';
  const isFailed = task.status === 'failed' || task.status === 'killed';

  return (
    <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors ${
      isRunning ? 'bg-ivory' : 'hover:bg-ivory/60'
    }`}>
      {/* Type icon */}
      <div className="shrink-0">
        <span className={`material-symbols-outlined text-[16px] ${
          isRunning ? 'text-stone animate-pulse' :
          isCompleted ? 'text-success' :
          isFailed ? 'text-error' :
          'text-stone/40'
        }`}>
          {TYPE_ICONS[task.type]}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-container-highest text-stone font-medium uppercase tracking-wide">
            {TYPE_LABELS[task.type]}
          </span>
          <span className={`text-[12px] ${isFailed ? 'text-error' : 'text-charcoal'} truncate`}>
            {task.description}
          </span>
        </div>
        {task.summary && (
          <div className="text-[11px] text-stone mt-0.5 truncate">{task.summary}</div>
        )}
        <div className="text-[10px] text-stone/50 mt-0.5">
          {isRunning
            ? `${formatDuration(Date.now() - task.startTime)} elapsed`
            : task.endTime
              ? `Completed in ${formatDuration(task.endTime - task.startTime)}`
              : ''
          }
        </div>
      </div>

      {/* Status indicator */}
      {isRunning && (
        <div className="w-[14px] h-[14px] rounded-full bg-stone flex items-center justify-center shrink-0">
          <span className="text-white text-[5px] tracking-[1px]">●●●</span>
        </div>
      )}
      {isCompleted && (
        <div className="w-[14px] h-[14px] rounded-full bg-success flex items-center justify-center shrink-0">
          <span className="text-white text-[8px] font-bold">✓</span>
        </div>
      )}
    </div>
  );
}
