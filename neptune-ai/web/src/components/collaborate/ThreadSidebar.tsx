import { useState, useEffect, useRef } from 'react';
import type { Thread } from '../../types/chat';
import { isCurrentThread, isBackendThread } from '../../types/chat';

interface ThreadSidebarProps {
  threads: Thread[];
  activeThreadId: string | null;
  onSwitchThread: (threadId: string) => void;
  onCreateThread: () => void;
  loading?: boolean;
}

function getStatusColor(status: Thread['status']): string {
  switch (status) {
    case 'running': return 'bg-[#4ade80]';
    case 'error': return 'bg-red-500';
    default: return 'bg-stone-400';
  }
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * ThreadSidebar — collapsible thread list panel on the left side of chat area.
 *
 * Collapsed: thin strip showing active thread title + expand button
 * Expanded: full thread list with sections (Current / Backend)
 */
export function ThreadSidebar({
  threads,
  activeThreadId,
  onSwitchThread,
  onCreateThread,
  loading = false,
}: ThreadSidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const activeThread = threads.find(t => t.id === activeThreadId);
  const activeTitle = activeThread?.title || 'New Thread';
  const activeStatus = activeThread?.status || 'idle';

  const currentThreads = threads.filter(isCurrentThread);
  const backendThreads = threads.filter(isBackendThread);

  // Click outside to collapse
  useEffect(() => {
    if (!isExpanded) return;
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isExpanded]);

  // === Collapsed state ===
  if (!isExpanded) {
    return (
      <div
        ref={panelRef}
        className="w-[44px] shrink-0 flex flex-col items-center border-r border-surface-container-highest bg-surface-container/50 pt-16 cursor-pointer hover:bg-surface-container transition-colors"
        onClick={() => setIsExpanded(true)}
        title={activeTitle}
      >
        {/* Status dot */}
        <div className="mt-4 mb-3">
          <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(activeStatus)}`} />
        </div>

        {/* Vertical title */}
        <div className="flex-1 flex items-start justify-center overflow-hidden">
          <span
            className="text-[11px] text-stone font-medium whitespace-nowrap origin-center"
            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)' }}
          >
            {activeTitle.length > 20 ? activeTitle.slice(0, 20) + '...' : activeTitle}
          </span>
        </div>

        {/* Expand hint */}
        <div className="mb-4 mt-2">
          <span className="material-symbols-outlined text-[14px] text-stone/50">chevron_right</span>
        </div>
      </div>
    );
  }

  // === Expanded state ===
  return (
    <div
      ref={panelRef}
      className="w-[220px] shrink-0 flex flex-col border-r border-surface-container-highest bg-surface-container pt-16 transition-all duration-200 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-surface-container-highest">
        <span className="text-[11px] font-bold text-stone uppercase tracking-wider">Threads</span>
        <button
          onClick={() => setIsExpanded(false)}
          className="p-1 text-stone hover:text-charcoal rounded transition-colors"
          title="收起"
        >
          <span className="material-symbols-outlined text-[16px]">chevron_left</span>
        </button>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {loading && threads.length === 0 ? (
          <div className="text-center py-8">
            <span className="text-[11px] text-stone">Loading...</span>
          </div>
        ) : threads.length === 0 ? (
          <div className="text-center py-8 px-3">
            <p className="text-[11px] text-stone">No threads yet</p>
          </div>
        ) : (
          <>
            {/* Current threads */}
            {currentThreads.length > 0 && (
              <div className="px-2 pt-2">
                <div className="px-2 py-1.5 mb-1">
                  <span className="text-[9px] font-bold text-stone/60 uppercase tracking-widest">Current</span>
                </div>
                {currentThreads.map((thread) => (
                  <ThreadSidebarItem
                    key={thread.id}
                    thread={thread}
                    isActive={thread.id === activeThreadId}
                    onClick={() => {
                      onSwitchThread(thread.id);
                      setIsExpanded(false);
                    }}
                  />
                ))}
              </div>
            )}

            {/* Backend threads */}
            {backendThreads.length > 0 && (
              <div className={`px-2 pt-2 ${currentThreads.length > 0 ? 'border-t border-surface-container-highest mt-2' : ''}`}>
                <div className="px-2 py-1.5 mb-1">
                  <span className="text-[9px] font-bold text-stone/60 uppercase tracking-widest">Backend</span>
                </div>
                {backendThreads.map((thread) => (
                  <ThreadSidebarItem
                    key={thread.id}
                    thread={thread}
                    isActive={thread.id === activeThreadId}
                    onClick={() => {
                      onSwitchThread(thread.id);
                      setIsExpanded(false);
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* New Thread button */}
      <div className="p-2 border-t border-surface-container-highest">
        <button
          onClick={() => {
            onCreateThread();
            setIsExpanded(false);
          }}
          className="w-full py-2 rounded-lg text-[11px] font-medium text-stone hover:text-charcoal hover:bg-surface-container-highest/60 transition-colors flex items-center justify-center gap-1"
        >
          <span className="material-symbols-outlined text-[14px]">add</span>
          New Thread
        </button>
      </div>
    </div>
  );
}

/** Individual thread item in the sidebar */
function ThreadSidebarItem({ thread, isActive, onClick }: { thread: Thread; isActive: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-2.5 py-2 rounded-lg transition-colors mb-0.5 ${
        isActive
          ? 'bg-surface-container-highest text-charcoal'
          : 'hover:bg-surface-container-highest/60 text-charcoal/80'
      }`}
    >
      <div className="flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full ${getStatusColor(thread.status)} shrink-0`} />
        <p className={`text-[11px] truncate flex-1 ${isActive ? 'font-semibold' : ''}`}>
          {thread.title || 'New Thread'}
        </p>
        <span className="text-[9px] text-stone/60 shrink-0">
          {thread.lastActiveAt ? timeAgo(thread.lastActiveAt) : ''}
        </span>
      </div>
    </button>
  );
}
