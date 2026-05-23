import React, { useState } from 'react';

interface ChatInputProps {
  agentName: string;
  onSend: (content: string) => void;
  onStop?: () => void;
  disabled?: boolean;
  streaming?: boolean;
  placeholder?: string;
}

export function ChatInput({ agentName, onSend, onStop, disabled, streaming, placeholder }: ChatInputProps) {
  const [inputText, setInputText] = useState('');

  const handleSend = () => {
    if (!inputText.trim() || disabled) return;
    onSend(inputText.trim());
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  const hasContent = inputText.trim().length > 0;

  return (
    <div className="p-6 pt-0 bg-transparent shrink-0 w-full max-w-4xl mx-auto flex flex-col relative z-10">
      <div className="relative flex items-end gap-1.5 bg-ivory rounded-2xl p-2 border border-border-cream shadow-sm focus-within:ring-1 focus-within:ring-border-cream transition-all w-full">
        {/* Left actions */}
        <button className="p-2 text-stone hover:text-charcoal hover:bg-surface-container rounded-full transition-colors mb-0.5 shrink-0" title="添加附件">
          <span className="material-symbols-outlined text-[20px]">add</span>
        </button>
        <button className="p-2 text-stone hover:text-charcoal hover:bg-surface-container rounded-full transition-colors mb-0.5 shrink-0" title="提及技能">
          <span className="material-symbols-outlined text-[20px]">alternate_email</span>
        </button>

        {/* Textarea */}
        <textarea
          className="w-full bg-transparent border-transparent focus:ring-0 resize-none text-sm py-2.5 px-2 max-h-[120px] outline-none text-charcoal placeholder:text-stone/60 custom-scrollbar"
          placeholder={placeholder || `输入问题或有意义的信息，输入 # 参 网站信息 选择智能体...`}
          rows={1}
          style={{ minHeight: '44px' }}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        {/* Right actions */}
        <button className="p-2 text-stone hover:text-charcoal hover:bg-surface-container rounded-full transition-colors mb-0.5 shrink-0" title="语音输入">
          <span className="material-symbols-outlined text-[20px]">mic</span>
        </button>
        {streaming ? (
          <button
            onClick={onStop}
            aria-label="停止生成"
            title="停止生成"
            className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-95 transition-all shrink-0 mb-0.5 bg-charcoal text-ivory hover:opacity-90"
          >
            <span className="material-symbols-outlined text-[18px]">stop</span>
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!hasContent || disabled}
            className={`w-9 h-9 rounded-xl flex items-center justify-center active:scale-95 transition-all shrink-0 mb-0.5 ${
              hasContent && !disabled
                ? 'bg-brand text-white hover:opacity-90'
                : 'bg-charcoal/20 text-stone/60'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
          </button>
        )}
      </div>
      <div className="mt-2 text-center">
        <span className="text-[10px] text-stone/70">内容由 AI 生成，请注意甄别</span>
      </div>
    </div>
  );
}
