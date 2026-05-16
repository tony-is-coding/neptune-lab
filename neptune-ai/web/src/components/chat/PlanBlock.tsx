import type { MessageBlock } from '../../types/chat';

interface PlanBlockProps {
  todos: Array<{
    content: string;
    status: 'pending' | 'in_progress' | 'completed';
    activeForm?: string;
  }>;
}

/**
 * PlanBlock — 计划列表可视化
 *
 * 内联展示 Agent 的执行计划，带状态指示
 */
export function PlanBlock({ todos }: PlanBlockProps) {
  const completed = todos.filter(t => t.status === 'completed').length;
  const total = todos.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="border border-border-cream rounded-[10px] overflow-hidden my-1">
      {/* Header with progress */}
      <div className="px-3 py-2 bg-ivory/50 flex items-center justify-between border-b border-border-cream">
        <span className="text-[12px] text-charcoal/70 font-medium">执行计划</span>
        <span className="text-[11px] text-stone">
          {completed}/{total}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-[2px] bg-border-cream">
        <div
          className="h-full bg-stone/50 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Todo items */}
      <div className="px-3 py-1.5 divide-y divide-border-cream/50">
        {todos.map((todo, i) => (
          <div key={i} className="flex items-start gap-2 py-1.5">
            {/* Status icon */}
            {todo.status === 'completed' && (
              <span className="w-[14px] h-[14px] rounded-full bg-stone/10 flex items-center justify-center shrink-0 mt-0.5">
                <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5.5L4 7.5L8 3" stroke="#5e5d59" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
            )}
            {todo.status === 'in_progress' && (
              <span className="w-[14px] h-[14px] rounded-full border-[1.5px] border-stone/30 border-t-stone animate-spin shrink-0 mt-0.5" />
            )}
            {todo.status === 'pending' && (
              <span className="w-[14px] h-[14px] rounded-full border-[1.5px] border-stone/20 shrink-0 mt-0.5" />
            )}

            {/* Content */}
            <span className={`text-[12px] leading-[1.5] ${
              todo.status === 'completed' ? 'text-stone line-through' :
              todo.status === 'in_progress' ? 'text-charcoal' :
              'text-charcoal/70'
            }`}>
              {todo.content}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
