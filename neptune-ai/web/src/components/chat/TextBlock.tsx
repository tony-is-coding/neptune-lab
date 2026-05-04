import { useEffect, useRef, useState } from 'react';

interface TextBlockProps {
  content: string;
  isStreaming?: boolean;
  onStreamComplete?: () => void;
}

export function TextBlock({ content, isStreaming, onStreamComplete }: TextBlockProps) {
  const [displayedContent, setDisplayedContent] = useState('');
  const indexRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isStreaming) {
      setDisplayedContent(content);
      return;
    }

    // Streaming mode: reveal characters one by one
    indexRef.current = 0;
    setDisplayedContent('');

    intervalRef.current = setInterval(() => {
      indexRef.current += 1;
      if (indexRef.current >= content.length) {
        setDisplayedContent(content);
        if (intervalRef.current) clearInterval(intervalRef.current);
        onStreamComplete?.();
        return;
      }
      setDisplayedContent(content.slice(0, indexRef.current));
    }, 20);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [content, isStreaming, onStreamComplete]);

  return (
    <div className="text-[13px] text-charcoal leading-[1.65]">
      <span className="whitespace-pre-wrap">{displayedContent}</span>
      {isStreaming && (
        <span className="inline-block w-[2px] h-[14px] bg-charcoal ml-[1px] animate-blink align-text-bottom" />
      )}
    </div>
  );
}
