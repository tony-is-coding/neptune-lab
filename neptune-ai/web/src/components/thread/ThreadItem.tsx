import type { Thread } from '../../types/chat';

interface ThreadItemProps {
  thread: Thread;
  isActive: boolean;
  onClick: () => void;
}

export function ThreadItem({ thread, isActive, onClick }: ThreadItemProps) {
  const StatusDot = () => {
    switch (thread.status) {
      case 'running':
        return <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0 mt-1" />;
      case 'idle':
        return <div className="w-2 h-2 rounded-full bg-stone-400 shrink-0 mt-1" />;
      case 'completed':
        return <span className="text-green-500 text-[10px] shrink-0 mt-0.5">✓</span>;
      case 'error':
        return <div className="w-2 h-2 rounded-full bg-red-500 shrink-0 mt-1" />;
    }
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-xl transition-colors border ${
        isActive
          ? 'bg-surface-container-highest border-border-cream/50 shadow-sm'
          : 'hover:bg-surface-container-highest/60 border-transparent'
      }`}
    >
      <div className="flex items-start gap-2">
        <StatusDot />
        <div className="flex-1 min-w-0">
          <p className={`text-[12px] truncate ${isActive ? 'font-semibold' : ''}`}>
            {thread.title || 'New Thread'}
          </p>
          {thread.summary && (
            <p className="text-[10px] text-stone truncate mt-0.5">{thread.summary}</p>
          )}
        </div>
        <span className="text-[9px] text-stone shrink-0">
          {thread.lastActiveAt ? timeAgo(thread.lastActiveAt) : ''}
        </span>
      </div>
    </button>
  );
}
