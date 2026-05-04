import type { Thread } from '../../types/chat';
import { ThreadItem } from './ThreadItem';

interface ThreadListProps {
  threads: Thread[];
  activeThreadId: string | null;
  onSwitch: (threadId: string) => void;
  onCreateNew: () => void;
}

export function ThreadList({ threads, activeThreadId, onSwitch, onCreateNew }: ThreadListProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
        {threads.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-[11px] text-stone">No threads yet</p>
            <p className="text-[10px] text-stone/60 mt-1">Send a message to start</p>
          </div>
        ) : (
          threads.map(thread => (
            <ThreadItem
              key={thread.id}
              thread={thread}
              isActive={thread.id === activeThreadId}
              onClick={() => onSwitch(thread.id)}
            />
          ))
        )}
      </div>
      <div className="p-3 border-t border-surface-container-highest">
        <button
          onClick={onCreateNew}
          className="w-full py-2 rounded-lg text-[11px] font-medium text-stone hover:text-charcoal hover:bg-surface-container-highest/60 transition-colors flex items-center justify-center gap-1"
        >
          <span className="material-symbols-outlined text-[14px]">add</span>
          New Thread
        </button>
      </div>
    </div>
  );
}
