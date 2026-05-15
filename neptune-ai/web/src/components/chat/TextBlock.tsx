import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface TextBlockProps {
  content: string;
  isStreaming?: boolean;
  onStreamComplete?: () => void;
}

export function TextBlock({ content, isStreaming, onStreamComplete }: TextBlockProps) {
  return (
    <div className="text-[14px] text-charcoal leading-[1.7] prose prose-neutral max-w-none
      prose-headings:text-charcoal prose-headings:font-semibold prose-headings:leading-snug
      prose-h1:text-[20px] prose-h1:mt-6 prose-h1:mb-3 prose-h1:pb-1 prose-h1:border-b prose-h1:border-border-cream
      prose-h2:text-[17px] prose-h2:mt-5 prose-h2:mb-2
      prose-h3:text-[15px] prose-h3:mt-4 prose-h3:mb-1.5
      prose-h4:text-[14px] prose-h4:mt-3 prose-h4:mb-1
      prose-p:my-2 prose-p:leading-[1.75]
      prose-ul:my-2 prose-ul:pl-5
      prose-ol:my-2 prose-ol:pl-5
      prose-li:my-1 prose-li:leading-[1.6]
      prose-strong:text-charcoal prose-strong:font-semibold
      prose-code:text-charcoal prose-code:bg-surface-container-highest prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[13px] prose-code:before:content-none prose-code:after:content-none
      prose-pre:bg-charcoal prose-pre:text-[#e8e6dc] prose-pre:rounded-xl prose-pre:my-4 prose-pre:text-[13px] prose-pre:leading-[1.5]
      prose-table:text-[13px] prose-table:my-4
      prose-th:text-left prose-th:py-2 prose-th:px-3 prose-th:border-b prose-th:border-border-cream prose-th:font-semibold
      prose-td:py-2 prose-td:px-3 prose-td:border-b prose-td:border-border-cream/50
      prose-a:text-terracotta prose-a:no-underline hover:prose-a:underline
      prose-blockquote:border-l-2 prose-blockquote:border-stone/30 prose-blockquote:pl-3 prose-blockquote:text-stone prose-blockquote:italic prose-blockquote:my-3
      prose-hr:border-border-cream prose-hr:my-5
    ">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      {isStreaming && (
        <span className="inline-block w-[2px] h-[14px] bg-charcoal ml-[1px] animate-blink align-text-bottom" />
      )}
    </div>
  );
}
