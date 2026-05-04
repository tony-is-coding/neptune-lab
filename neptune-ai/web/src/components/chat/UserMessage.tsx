import type { ChatMessage } from '../../types/chat';

interface UserMessageProps {
  message: ChatMessage;
}

export function UserMessage({ message }: UserMessageProps) {
  const textBlock = message.blocks.find(b => b.type === 'text');
  const content = textBlock?.type === 'text' ? textBlock.content : '';

  return (
    <div className="flex gap-3 max-w-[90%] self-end flex-row-reverse ml-auto">
      <div className="w-8 h-8 rounded-full bg-charcoal flex items-center justify-center shrink-0">
        <span className="text-white text-xs font-bold">U</span>
      </div>
      <div className="p-4 rounded-2xl rounded-tr-sm bg-ivory border border-border-cream shadow-sm">
        <p className="text-sm text-charcoal leading-relaxed whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );
}
