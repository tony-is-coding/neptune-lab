import { useState } from 'react';
import type { PlanTask } from '../../types/chat';

interface PlanTaskItemProps {
  task: PlanTask;
  allTasks: PlanTask[];
}

export function PlanTaskItem({ task, allTasks }: PlanTaskItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const isBlocked = task.status === 'pending' && task.blockedBy.some(id =>
    allTasks.find(t => t.id === id)?.status !== 'completed'
  );

  const isCompleted = task.status === 'completed';
  const isInProgress = task.status === 'in_progress';

  return (
    <div className="group">
      <div
        className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
          isInProgress ? 'bg-ivory' : 'hover:bg-ivory/60'
        }`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Status icon */}
        <div className="mt-0.5 shrink-0">
          {isCompleted && (
            <div className="w-[18px] h-[18px] rounded-full bg-success flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">✓</span>
            </div>
          )}
          {isInProgress && (
            <div className="w-[18px] h-[18px] rounded-full bg-stone flex items-center justify-center">
              <span className="text-white text-[6px] tracking-[1px]">●●●</span>
            </div>
          )}
          {task.status === 'pending' && isBlocked && (
            <div className="w-[18px] h-[18px] rounded-full border-2 border-stone/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-[10px] text-stone/40">lock</span>
            </div>
          )}
          {task.status === 'pending' && !isBlocked && (
            <div className="w-[18px] h-[18px] rounded-full border-2 border-stone/40" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className={`text-[13px] leading-snug ${isCompleted ? 'text-stone line-through' : 'text-charcoal font-medium'}`}>
            {task.subject}
          </div>
          {isInProgress && task.activeForm && (
            <div className="text-[11px] text-stone mt-0.5">{task.activeForm}</div>
          )}
          {isBlocked && (
            <div className="text-[11px] text-stone/60 mt-0.5">
              Blocked by #{task.blockedBy[0]}
            </div>
          )}
          {task.owner && !isCompleted && (
            <div className="text-[10px] text-stone/60 mt-0.5">Owner: {task.owner}</div>
          )}
        </div>

        {/* Expand arrow */}
        <span className={`text-stone/40 text-[10px] mt-1 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="ml-[26px] mr-3 mb-2 pl-3 border-l-2 border-border-cream">
          <p className="text-[12px] text-stone leading-relaxed py-1">{task.description}</p>
          {task.blocks.length > 0 && (
            <div className="text-[11px] text-stone/60 py-1">
              Blocks: {task.blocks.map(id => `#${id}`).join(', ')}
            </div>
          )}
          {task.blockedBy.length > 0 && (
            <div className="text-[11px] text-stone/60 py-1">
              Blocked by: {task.blockedBy.map(id => `#${id}`).join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
