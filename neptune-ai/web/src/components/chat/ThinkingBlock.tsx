import { useState } from 'react';

interface ThinkingBlockProps {
  content: string;
  duration?: number;
  isStreaming?: boolean;
}

export function ThinkingBlock({ content, duration, isStreaming }: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className="bg-ivory border border-border-cream rounded-[10px] px-3.5 py-2.5 cursor-pointer hover:bg-surface-container transition-colors"
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="flex items-center gap-2">
        {isStreaming ? (
          <span className="text-stone text-[12px]">💭</span>
        ) : (
          <span className="text-stone/50 text-[12px]">✅</span>
        )}
        {isStreaming ? (
          <div className="flex items-center gap-1">
            <span className="text-[12px] text-charcoal/60 font-medium">思考中</span>
            <span className="flex gap-0.5">
              <span className="w-1 h-1 bg-charcoal/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-1 bg-charcoal/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1 h-1 bg-charcoal/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
          </div>
        ) : (
          <span className="text-[12px] text-charcoal font-medium">
            思考了 {duration ? `${duration}秒` : '片刻'}
          </span>
        )}
        {!isStreaming && (
          <span className={`text-stone/50 text-[10px] ml-auto transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
        )}
      </div>
      {isExpanded && !isStreaming && (
        <div className="mt-2 pt-2 border-t border-border-cream/50 text-[12px] text-stone leading-relaxed">
          {content}
        </div>
      )}
    </div>
  );
}
