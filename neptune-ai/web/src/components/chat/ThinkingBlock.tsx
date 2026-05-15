import { useState } from 'react';

interface ThinkingBlockProps {
  content: string;
  duration?: number;
  isStreaming?: boolean;
}

/**
 * ThinkingBlock — 思考过程展示
 *
 * 设计参考：Claude 风格
 * - 流式中：显示 "思考中..." 文字 + 实时内容
 * - 完成后：折叠为 "思考完成 >"，点击展开查看内容
 * - 遵循 DESIGN.md 暖色系设计规范
 */
export function ThinkingBlock({ content, duration, isStreaming }: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const showContent = isStreaming || isExpanded;

  return (
    <div className="my-0.5">
      {/* Header toggle */}
      <div
        className="inline-flex items-center gap-1 cursor-pointer select-none group"
        onClick={() => !isStreaming && setIsExpanded(!isExpanded)}
      >
        <span className="text-[13px] text-stone font-medium group-hover:text-charcoal transition-colors">
          {isStreaming ? '思考中...' : `思考完成${duration ? ` (${duration}s)` : ''}`}
        </span>
        {!isStreaming && (
          <span className={`text-stone text-[11px] transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
            ›
          </span>
        )}
      </div>

      {/* Thinking content */}
      {showContent && content && (
        <div className="mt-2 text-[13px] text-stone/80 leading-[1.6] whitespace-pre-wrap max-h-[300px] overflow-y-auto">
          {content}
          {isStreaming && (
            <span className="inline-block w-[1.5px] h-[13px] bg-stone/50 ml-0.5 animate-pulse align-middle" />
          )}
        </div>
      )}
    </div>
  );
}
