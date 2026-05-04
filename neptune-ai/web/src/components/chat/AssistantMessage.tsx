import type { ChatMessage, MessageBlock } from '../../types/chat';
import { ThinkingBlock } from './ThinkingBlock';
import { TextBlock } from './TextBlock';
import { ToolUseBlock } from './ToolUseBlock';
import { ArtifactBlock } from './ArtifactBlock';

interface AssistantMessageProps {
  message: ChatMessage;
  agentIcon: string;
  onOpenArtifact: (block: Extract<MessageBlock, { type: 'artifact' }>) => void;
}

export function AssistantMessage({ message, agentIcon, onOpenArtifact }: AssistantMessageProps) {
  const isStreaming = message.status === 'streaming';

  return (
    <div className="flex gap-3 max-w-[95%]">
      <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center shrink-0 mt-1">
        <span className="material-symbols-outlined text-[16px] text-on-secondary-container">{agentIcon}</span>
      </div>
      <div className="flex-1 flex flex-col gap-3">
        {message.blocks.map((block, index) => {
          switch (block.type) {
            case 'thinking':
              return (
                <ThinkingBlock
                  key={`${message.id}-thinking-${index}`}
                  content={block.content}
                  duration={block.duration}
                  isStreaming={isStreaming && index === message.blocks.length - 1}
                />
              );

            case 'text': {
              // Determine if this text block is the currently streaming one
              const isLastTextBlock = message.blocks.slice(index + 1).every(b => b.type !== 'text');
              const isActivelyStreaming = isStreaming && isLastTextBlock &&
                index === message.blocks.length - 1;
              return (
                <TextBlock
                  key={`${message.id}-text-${index}`}
                  content={block.content}
                  isStreaming={isActivelyStreaming}
                />
              );
            }

            case 'tool_use': {
              // Find matching tool_result
              const toolResult = message.blocks.find(
                (b): b is Extract<MessageBlock, { type: 'tool_result' }> =>
                  b.type === 'tool_result' && b.toolUseId === block.id
              );
              return (
                <ToolUseBlock
                  key={`${message.id}-tool-${block.id}`}
                  block={block}
                  toolResult={toolResult}
                />
              );
            }

            case 'tool_result':
              // Rendered inside ToolUseBlock, skip standalone rendering
              return null;

            case 'artifact':
              return (
                <ArtifactBlock
                  key={`${message.id}-artifact-${block.id}`}
                  block={block}
                  onOpen={() => onOpenArtifact(block)}
                />
              );

            default:
              return null;
          }
        })}
      </div>
    </div>
  );
}
