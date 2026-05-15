import { useState } from 'react';
import type { MessageBlock, AskUserQuestion } from '../../types/chat';

interface QuestionBlockProps {
  block: Extract<MessageBlock, { type: 'ask_user' }>;
  onAnswer: (id: string, answers: Record<string, string>) => void;
}

export function QuestionBlock({ block, onAnswer }: QuestionBlockProps) {
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});
  const [showCustom, setShowCustom] = useState<Record<string, boolean>>({});

  const handleSelect = (question: string, label: string) => {
    setSelections(prev => ({ ...prev, [question]: label }));
    setShowCustom(prev => ({ ...prev, [question]: false }));
  };

  const handleCustomToggle = (question: string) => {
    setShowCustom(prev => ({ ...prev, [question]: true }));
    setSelections(prev => {
      const next = { ...prev };
      delete next[question];
      return next;
    });
  };

  const handleSubmit = () => {
    const answers: Record<string, string> = {};
    for (const q of block.questions) {
      if (showCustom[q.question] && customInputs[q.question]) {
        answers[q.question] = customInputs[q.question];
      } else if (selections[q.question]) {
        answers[q.question] = selections[q.question];
      }
    }
    if (Object.keys(answers).length > 0) {
      onAnswer(block.id, answers);
    }
  };

  const allAnswered = block.questions.every(q =>
    selections[q.question] || (showCustom[q.question] && customInputs[q.question])
  );

  // Already answered state
  if (block.answered) {
    return (
      <div className="border border-border-cream rounded-[10px] overflow-hidden opacity-70">
        <div className="px-4 py-3 bg-ivory">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-[18px] h-[18px] rounded-full bg-success flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">✓</span>
            </div>
            <span className="text-[12px] font-semibold text-charcoal">已回答</span>
          </div>
          {block.answers && Object.entries(block.answers).map(([q, a]) => (
            <div key={q} className="text-[12px] text-stone ml-[26px]">
              <span className="text-charcoal/70">{q}</span>
              <span className="mx-1.5">→</span>
              <span className="font-medium text-charcoal">{a}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="border border-terracotta/30 rounded-[10px] overflow-hidden shadow-sm">
      <div className="px-4 py-3 bg-gradient-to-b from-ivory to-surface-lowest">
        {block.questions.map((q, qi) => (
          <div key={qi} className={qi > 0 ? 'mt-4 pt-4 border-t border-border-cream' : ''}>
            {/* Question header */}
            <div className="flex items-center gap-2 mb-3">
              {q.header && (
                <span className="text-[10px] font-bold text-terracotta uppercase tracking-wider bg-terracotta/10 px-2 py-0.5 rounded">
                  {q.header}
                </span>
              )}
              <span className="text-[13px] font-medium text-charcoal">{q.question}</span>
            </div>

            {/* Options */}
            <div className="flex flex-wrap gap-2 mb-2">
              {q.options.map((opt, oi) => {
                const isSelected = selections[q.question] === opt.label;
                return (
                  <button
                    key={oi}
                    onClick={() => handleSelect(q.question, opt.label)}
                    className={`px-3 py-2 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'border-terracotta bg-terracotta/10 text-charcoal shadow-sm'
                        : 'border-border-cream bg-white hover:border-stone/40 text-charcoal/80'
                    }`}
                  >
                    <div className="text-[12px] font-medium">{opt.label}</div>
                    {opt.description && (
                      <div className="text-[11px] text-stone mt-0.5">{opt.description}</div>
                    )}
                  </button>
                );
              })}

              {/* Custom input toggle */}
              <button
                onClick={() => handleCustomToggle(q.question)}
                className={`px-3 py-2 rounded-lg border text-left transition-all ${
                  showCustom[q.question]
                    ? 'border-terracotta bg-terracotta/10 text-charcoal'
                    : 'border-dashed border-stone/30 hover:border-stone/50 text-stone'
                }`}
              >
                <div className="text-[12px]">自定义...</div>
              </button>
            </div>

            {/* Custom input field */}
            {showCustom[q.question] && (
              <input
                type="text"
                placeholder="输入你的回答..."
                value={customInputs[q.question] || ''}
                onChange={e => setCustomInputs(prev => ({ ...prev, [q.question]: e.target.value }))}
                className="w-full px-3 py-2 text-[12px] border border-border-cream rounded-lg bg-white focus:outline-none focus:border-terracotta/50 text-charcoal placeholder:text-stone/50"
                autoFocus
              />
            )}
          </div>
        ))}

        {/* Submit button */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={!allAnswered}
            className={`px-4 py-2 rounded-lg text-[12px] font-medium transition-all ${
              allAnswered
                ? 'bg-terracotta text-white hover:bg-terracotta/90 shadow-sm'
                : 'bg-stone/20 text-stone cursor-not-allowed'
            }`}
          >
            提交回答
          </button>
        </div>
      </div>
    </div>
  );
}
