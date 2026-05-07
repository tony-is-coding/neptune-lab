import { Link } from 'react-router-dom';

/**
 * B0: 零 Agent 引导卡片
 * 显示条件：新注册用户 或 所有 Agent 被删除
 */
export function EmptyCollaborateView() {
  return (
    <div className="flex-1 flex items-center justify-center h-full">
      <div className="text-center max-w-[400px]">
        <div className="w-20 h-20 rounded-full bg-surface-container-low flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-outlined text-[40px] text-stone">
            smart_toy
          </span>
        </div>
        <h2 className="font-serif text-[24px] text-charcoal mb-3">
          Find an AI Employee to collaborate with
        </h2>
        <p className="text-sm text-stone leading-relaxed mb-6">
          Browse your AI Employees and start working together.
        </p>
        <Link
          to="/agents"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-sm bg-brand text-white hover:bg-brand/90 transition-colors shadow-sm"
        >
          <span className="material-symbols-outlined text-[18px]">
            arrow_forward
          </span>
          Go to Agents →
        </Link>
      </div>
    </div>
  );
}
