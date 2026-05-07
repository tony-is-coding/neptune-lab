import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface TextBlockProps {
  content: string;
  isStreaming?: boolean;
  onStreamComplete?: () => void;
}

export function TextBlock({ content, isStreaming, onStreamComplete }: TextBlockProps) {
  // 后端已经做真流逐字推送，前端直接显示 content，不做二次缓冲
  // 移除了 setInterval 逐字动画逻辑

  return (
    <div className="text-[13px] text-charcoal leading-[1.65] prose prose-sm prose-neutral max-w-none prose-headings:text-charcoal prose-headings:font-semibold prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-strong:text-charcoal prose-code:text-charcoal prose-code:bg-surface-container-highest prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-[12px] prose-code:before:content-none prose-code:after:content-none prose-pre:bg-charcoal prose-pre:text-[#e8e6dc] prose-pre:rounded-xl prose-pre:my-3 prose-table:text-[12px] prose-th:text-left prose-th:py-2 prose-th:px-3 prose-th:border-b prose-th:border-border-cream prose-td:py-2 prose-td:px-3 prose-td:border-b prose-td:border-border-cream/50">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      {isStreaming && (
        <span className="inline-block w-[2px] h-[14px] bg-charcoal ml-[1px] animate-blink align-text-bottom" />
      )}
    </div>
  );
}
