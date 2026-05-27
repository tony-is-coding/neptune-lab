import type { MessageBlock } from '../../types/chat';

interface QuestionBlockProps {
  block: Extract<MessageBlock, { type: 'ask_user' }>;
  /**
   * 保留 onAnswer 类型签名以避免破坏 AssistantMessage 的接口；
   * 当前实现下 onAnswer 不会被调用——回答提交链路待
   * `docs/governance/engine-contract.md §3.1` engine 端接口落地后接通。
   */
  onAnswer?: (id: string, answers: Record<string, string>) => void;
}

/**
 * AskUserQuestion 预览卡片
 *
 * 当前限制（2026-05-26）：
 * - `AgentEngine.query(sessionId, input: string)` 仅接受字符串 input，
 *   无 tool_result 注入接口
 * - 用户即便选择答案，server `/reply` 路由也无法把答案回灌给 engine
 * - 因此本卡片**只读展示问题与选项**，不收集回答、不显示提交按钮
 *
 * engine 端接口落地后（见 governance 文档），恢复完整交互。
 */
export function QuestionBlock({ block }: QuestionBlockProps) {
  return (
    <div
      data-testid="ask-user-preview"
      className="border border-terracotta/30 rounded-[10px] overflow-hidden shadow-sm"
    >
      <div className="px-4 py-3 bg-gradient-to-b from-ivory to-surface-lowest">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-bold text-terracotta uppercase tracking-wider bg-terracotta/10 px-2 py-0.5 rounded">
            预览
          </span>
          <span className="text-[12px] text-stone">
            智能体提问预览（当前回答暂不进入下一轮推理，等待运行时接口落地）
          </span>
        </div>

        {block.questions.map((q, qi) => (
          <div key={qi} className={qi > 0 ? 'mt-4 pt-4 border-t border-border-cream' : ''}>
            <div className="flex items-center gap-2 mb-3">
              {q.header && (
                <span className="text-[10px] font-bold text-terracotta uppercase tracking-wider bg-terracotta/10 px-2 py-0.5 rounded">
                  {q.header}
                </span>
              )}
              <span className="text-[13px] font-medium text-charcoal">{q.question}</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {q.options.map((opt, oi) => (
                <div
                  key={oi}
                  className="px-3 py-2 rounded-lg border border-border-cream bg-white text-charcoal/80 cursor-not-allowed"
                  aria-disabled="true"
                >
                  <div className="text-[12px] font-medium">{opt.label}</div>
                  {opt.description && (
                    <div className="text-[11px] text-stone mt-0.5">{opt.description}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
