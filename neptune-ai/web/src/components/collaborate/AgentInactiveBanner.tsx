/**
 * B2a: Agent 被停用横幅
 * 显示条件：Agent.isActive === false
 */
export function AgentInactiveBanner() {
  return (
    <div className="w-full px-4 py-2 bg-surface-container border-b border-surface-container-highest flex items-center gap-2 text-sm text-stone">
      <span className="material-symbols-outlined text-[18px]">
        pause_circle
      </span>
      <span>This AI Employee is currently inactive</span>
    </div>
  );
}
