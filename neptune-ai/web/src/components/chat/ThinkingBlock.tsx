import { useState } from 'react';

interface ThinkingBlockProps {
  content: string;
  duration?: number;
  isStreaming?: boolean;
  toolCallCount?: number;
}

/**
 * ThinkingBlock — 思考过程展示
 *
 * 设计参考：Claude 风格
 * - 流式中：显示 "思考中..." 文字 + 实时内容
 * - 完成后：折叠为摘要行，点击展开查看内容
 * - 遵循 DESIGN.md 暖色系设计规范
 */
export function ThinkingBlock({ content, duration, isStreaming, toolCallCount }: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const showContent = isStreaming || isExpanded;

  // Summary text when collapsed
  const summaryText = (() => {
    if (isStreaming) return '思考中...';
    const parts: string[] = [];
    if (toolCallCount && toolCallCount > 0) {
      parts.push(`已完成 ${toolCallCount} 次工具调用`);
    }
    if (duration) {
      parts.push(`${duration}s`);
    }
    return parts.length > 0 ? parts.join(' · ') : '思考完成';
  })();

  return (
    <div className="my-0.5">
      {/* Header toggle */}
      <div
        className="inline-flex items-center gap-1.5 cursor-pointer select-none group"
        onClick={() => !isStreaming && setIsExpanded(!isExpanded)}
      >
        {!isStreaming && (
          <span className={`text-stone/60 text-[11px] transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
            ›
          </span>
        )}
        <span className="text-[13px] text-stone font-medium group-hover:text-charcoal transition-colors">
          {summaryText}
        </span>
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
