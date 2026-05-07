import { useState, useEffect, useRef } from 'react';
import type { Thread } from '../../types/chat';
import { ThreadItem } from '../thread/ThreadItem';
import { isCurrentThread, isBackendThread } from '../../types/chat';

interface ThreadDropdownProps {
  threads: Thread[];
  activeThreadId: string | null;
  onSwitchThread: (threadId: string) => void;
  onCreateThread: () => void;
  loading?: boolean;
}

/**
 * 获取 Thread 状态颜色
 */
function getStatusColor(status: Thread['status']): string {
  switch (status) {
    case 'running':
      return 'bg-[#4ade80]';
    case 'idle':
      return 'bg-stone-400';
    case 'error':
      return 'bg-red-500';
    default:
      return 'bg-stone-400';
  }
}

/**
 * 获取当前 Thread 的显示标题
 */
function getCurrentThreadTitle(threads: Thread[], activeThreadId: string | null): string {
  if (!activeThreadId) return 'New Thread';
  const activeThread = threads.find(t => t.id === activeThreadId);
  return activeThread?.title || 'New Thread';
}

/**
 * 获取当前 Thread 的状态
 */
function getCurrentThreadStatus(threads: Thread[], activeThreadId: string | null): Thread['status'] | null {
  if (!activeThreadId) return null;
  const activeThread = threads.find(t => t.id === activeThreadId);
  return activeThread?.status || null;
}

/**
 * ThreadDropdown 组件
 * 顶栏 Thread 切换下拉，支持展开/收起、选择 Thread、创建新 Thread
 * 分层显示：Current（用户可交互）和 Backend（Agent 工作中）
 */
export function ThreadDropdown({
  threads,
  activeThreadId,
  onSwitchThread,
  onCreateThread,
  loading = false,
}: ThreadDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 点击外部收起下拉
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const currentStatus = getCurrentThreadStatus(threads, activeThreadId);
  const currentTitle = getCurrentThreadTitle(threads, activeThreadId);

  // 分组 Thread
  const currentThreads = threads.filter(isCurrentThread);
  const backendThreads = threads.filter(isBackendThread);

  return (
    <div ref={dropdownRef} className="relative">
      {/* 触发按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-surface-container transition-colors text-sm"
      >
        <span className="font-medium text-charcoal truncate max-w-[200px]">
          {currentTitle}
        </span>
        <span className="material-symbols-outlined text-[18px] text-stone">
          {isOpen ? 'expand_less' : 'expand_more'}
        </span>
        {currentStatus && (
          <div className={`w-2 h-2 rounded-full ${getStatusColor(currentStatus)}`} />
        )}
      </button>

      {/* 下拉面板 */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-[320px] bg-surface-container border border-surface-container-highest rounded-xl shadow-lg z-40">
          {/* Thread 列表 - 分层显示 */}
          <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
            {loading && threads.length === 0 ? (
              <div className="text-center py-8">
                <span className="text-[11px] text-stone">Loading threads...</span>
              </div>
            ) : threads.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-[11px] text-stone">No threads yet</p>
                <p className="text-[10px] text-stone/60 mt-1">Send a message to start</p>
              </div>
            ) : (
              <>
                {/* Current 区域 */}
                {currentThreads.length > 0 && (
                  <div className="p-2">
                    <div className="px-3 py-2 mb-1">
                      <span className="text-[10px] font-bold text-stone uppercase tracking-widest">Current</span>
                    </div>
                    {currentThreads.map((thread) => (
                      <ThreadItem
                        key={thread.id}
                        thread={thread}
                        isActive={thread.id === activeThreadId}
                        onClick={() => {
                          onSwitchThread(thread.id);
                          setIsOpen(false);
                        }}
                      />
                    ))}
                  </div>
                )}

                {/* Backend 区域 */}
                {backendThreads.length > 0 && (
                  <div className={`p-2 ${currentThreads.length > 0 ? 'border-t border-surface-container-highest' : ''}`}>
                    <div className="px-3 py-2 mb-1">
                      <span className="text-[10px] font-bold text-stone uppercase tracking-widest">Backend</span>
                    </div>
                    {backendThreads.map((thread) => (
                      <ThreadItem
                        key={thread.id}
                        thread={thread}
                        isActive={thread.id === activeThreadId}
                        onClick={() => {
                          onSwitchThread(thread.id);
                          setIsOpen(false);
                        }}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* 底部按钮 */}
          <div className="p-2 border-t border-surface-container-highest">
            <button
              onClick={() => {
                onCreateThread();
                setIsOpen(false);
              }}
              className="w-full py-2 rounded-lg text-[11px] font-medium text-stone hover:text-charcoal hover:bg-surface-container-highest/60 transition-colors flex items-center justify-center gap-1"
            >
              <span className="material-symbols-outlined text-[14px]">
                add
              </span>
              New Thread
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
