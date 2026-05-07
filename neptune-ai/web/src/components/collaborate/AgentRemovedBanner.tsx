/**
 * B2b: Agent 被删除横幅
 * 显示条件：Agent 在列表中不存在（404）
 */
export function AgentRemovedBanner() {
  return (
    <div className="px-4 py-2 bg-red-50 border-b border-red-200 flex items-center gap-2 text-sm text-red-700">
      <span className="material-symbols-outlined text-[18px]">
        error
      </span>
      <span>AI Employee has been removed</span>
    </div>
  );
}
