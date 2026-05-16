import { useState } from 'react';
import type { PlanTodo } from '../../types/chat';

interface FloatingPlanPanelProps {
  todos: PlanTodo[];
}

/**
 * FloatingPlanPanel — 固定在输入框上方的计划面板
 *
 * 交互：
 * - 有 plan 时显示
 * - 支持收起/展开
 * - 收起时只显示一行进度
 * - 展开时显示完整任务列表
 * - 实时更新状态
 */
export function FloatingPlanPanel({ todos }: FloatingPlanPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!todos || todos.length === 0) return null;

  const completed = todos.filter(t => t.status === 'completed').length;
  const inProgress = todos.find(t => t.status === 'in_progress');
  const total = todos.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
  const allDone = completed === total;

  return (
    <div className="mx-4 mb-2">
      <div className="border border-border-cream rounded-[10px] overflow-hidden bg-ivory/80 backdrop-blur-sm shadow-sm">
        {/* Header */}
        <div
          className="px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-surface-container/50 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-charcoal/70 font-medium">执行计划</span>
            {!isExpanded && inProgress && (
              <span className="text-[11px] text-stone truncate max-w-[200px]">
                — {inProgress.content}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[11px] ${allDone ? 'text-success' : 'text-stone'}`}>
              {allDone ? '✓ 完成' : `${completed}/${total}`}
            </span>
            <span className={`text-stone/50 text-[10px] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
              ▾
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-[2px] bg-border-cream">
          <div
            className={`h-full transition-all duration-500 ${allDone ? 'bg-success' : 'bg-stone/40'}`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Expanded: task list */}
        {isExpanded && (
          <div className="px-3 py-1.5 max-h-[180px] overflow-y-auto custom-scrollbar">
            {todos.map((todo, i) => (
              <div key={i} className="flex items-start gap-2 py-1">
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
                  todo.status === 'in_progress' ? 'text-charcoal font-medium' :
                  'text-charcoal/70'
                }`}>
                  {todo.content}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
