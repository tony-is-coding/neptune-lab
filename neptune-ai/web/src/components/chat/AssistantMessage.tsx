import type { ChatMessage, MessageBlock } from '../../types/chat';
import { ThinkingBlock } from './ThinkingBlock';
import { TextBlock } from './TextBlock';
import { ToolUseBlock } from './ToolUseBlock';
import { ArtifactBlock } from './ArtifactBlock';
import { QuestionBlock } from './QuestionBlock';
import { PlanBlock } from './PlanBlock';

interface AssistantMessageProps {
  message: ChatMessage;
  agentIcon: string;
  onOpenArtifact: (block: Extract<MessageBlock, { type: 'artifact' }>) => void;
  onAnswerQuestion?: (id: string, answers: Record<string, string>) => void;
}

/**
 * 三个跳动的点动画 - 用于"思考中..."等待提示
 * 参考 Claude 风格的简洁跳动动画
 */
function ThinkingDots() {
  return (
    <span className="flex items-center gap-0.5 ml-0.5">
      <span className="w-1 h-1 bg-charcoal/40 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
      <span className="w-1 h-1 bg-charcoal/40 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
      <span className="w-1 h-1 bg-charcoal/40 rounded-full animate-bounce"></span>
    </span>
  );
}

export function AssistantMessage({ message, agentIcon, onOpenArtifact, onAnswerQuestion }: AssistantMessageProps) {
  const isStreaming = message.status === 'streaming';

  // 检查是否为等待状态：只有单个 thinking block 且正在 streaming
  const isWaiting = isStreaming &&
    message.blocks.length === 1 &&
    message.blocks[0].type === 'thinking' &&
    message.blocks[0].content === '思考中...';

  // 将连续的 tool_use blocks 分组
  const groupedBlocks = groupConsecutiveTools(message.blocks);

  return (
    <div className="max-w-[95%]">
      <div className="flex flex-col gap-0.5">
        {isWaiting ? (
          // 等待状态：显示简洁的"思考中..."动画
          <div className="flex items-center gap-2 py-1">
            <span className="text-stone text-[14px]">💭</span>
            <span className="text-[13px] text-charcoal/60 font-medium">思考中...</span>
            <ThinkingDots />
          </div>
        ) : (
          // 正常状态：渲染分组后的 blocks
          groupedBlocks.map((group, groupIndex) => {
            if (group.type === 'tool_group') {
              // 连续工具调用合并为一个容器
              return (
                <div
                  key={`${message.id}-toolgroup-${groupIndex}`}
                  className="border border-border-cream rounded-[10px] overflow-hidden my-0.5 divide-y divide-border-cream"
                >
                  {group.blocks.map((block) => {
                    const toolResult = message.blocks.find(
                      (b): b is Extract<MessageBlock, { type: 'tool_result' }> =>
                        b.type === 'tool_result' && b.toolUseId === block.id
                    );
                    return (
                      <ToolUseBlock
                        key={`${message.id}-tool-${block.id}`}
                        block={block}
                        toolResult={toolResult}
                        grouped
                      />
                    );
                  })}
                </div>
              );
            }

            const block = group.block;
            const index = group.originalIndex;

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

              case 'tool_result':
                return null;

              case 'artifact':
                return (
                  <ArtifactBlock
                    key={`${message.id}-artifact-${block.id}`}
                    block={block}
                    onOpen={() => onOpenArtifact(block)}
                  />
                );

              case 'ask_user':
                return (
                  <QuestionBlock
                    key={`${message.id}-ask-${block.id}`}
                    block={block}
                    onAnswer={onAnswerQuestion || (() => {})}
                  />
                );

              case 'plan':
                return (
                  <PlanBlock
                    key={`${message.id}-plan-${block.id}`}
                    todos={block.todos}
                  />
                );

              default:
                return null;
            }
          })
        )}
      </div>
    </div>
  );
}

type GroupedBlock =
  | { type: 'tool_group'; blocks: Extract<MessageBlock, { type: 'tool_use' }>[] }
  | { type: 'single'; block: MessageBlock; originalIndex: number };

/** 将连续的 tool_use blocks 合并为一组 */
function groupConsecutiveTools(blocks: MessageBlock[]): GroupedBlock[] {
  const result: GroupedBlock[] = [];
  let currentToolGroup: Extract<MessageBlock, { type: 'tool_use' }>[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.type === 'tool_use') {
      currentToolGroup.push(block);
    } else {
      if (currentToolGroup.length > 0) {
        result.push({ type: 'tool_group', blocks: [...currentToolGroup] });
        currentToolGroup = [];
      }
      if (block.type !== 'tool_result') {
        result.push({ type: 'single', block, originalIndex: i });
      }
    }
  }

  if (currentToolGroup.length > 0) {
    result.push({ type: 'tool_group', blocks: currentToolGroup });
  }

  return result;
}
