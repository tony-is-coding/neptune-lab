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
        <span className="text-stone text-[12px]">💭</span>
        {isStreaming ? (
          <span className="text-[12px] text-stone font-medium animate-pulse">Thinking...</span>
        ) : (
          <span className="text-[12px] text-stone font-medium">
            Thought for {duration ? `${duration}s` : 'a moment'}
          </span>
        )}
        <span className={`text-stone/50 text-[10px] ml-auto transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
      </div>
      {isExpanded && !isStreaming && (
        <div className="mt-2 pt-2 border-t border-border-cream/50 text-[12px] text-stone leading-relaxed">
          {content}
        </div>
      )}
    </div>
  );
}
