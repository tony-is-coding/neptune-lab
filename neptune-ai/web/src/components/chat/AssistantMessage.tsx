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

/** Format timestamp for display */
function formatMessageTime(isoStr?: string): string {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${mm}-${dd} ${hh}:${min}`;
}

/** Count tool_use blocks following a thinking block until next thinking or end */
function countToolCallsAfterThinking(blocks: MessageBlock[], thinkingIndex: number): number {
  let count = 0;
  for (let i = thinkingIndex + 1; i < blocks.length; i++) {
    if (blocks[i].type === 'thinking') break;
    if (blocks[i].type === 'tool_use') count++;
  }
  return count;
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

  const timeStr = formatMessageTime(message.createdAt);

  return (
    <div className="max-w-[95%] group/msg">
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
              // 连续工具调用合并为一个容器，带左侧竖线引导
              return (
                <div
                  key={`${message.id}-toolgroup-${groupIndex}`}
                  className="my-1"
                >
                  <div className="border border-charcoal/20 rounded-lg overflow-hidden divide-y divide-charcoal/10">
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
                    toolCallCount={countToolCallsAfterThinking(message.blocks, index)}
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
                // Artifacts show in right sidebar, not inline
                return null;

              case 'ask_user':
                return (
                  <QuestionBlock
                    key={`${message.id}-ask-${block.id}`}
                    block={block}
                    onAnswer={onAnswerQuestion || (() => {})}
                  />
                );

              case 'plan':
                // Plan 在右侧面板显示，不内联渲染
                return null;

              default:
                return null;
            }
          })
        )}
      </div>

      {/* Footer: timestamp + feedback (only show when message is complete) */}
      {!isStreaming && !isWaiting && (
        <div className="flex items-center gap-3 mt-2 pl-0.5">
          {timeStr && (
            <span className="text-[11px] text-stone/60">{timeStr}</span>
          )}
          <div className="flex items-center gap-1 opacity-0 group-hover/msg:opacity-100 transition-opacity">
            <button className="p-1 text-stone/50 hover:text-charcoal rounded transition-colors" title="有帮助">
              <span className="material-symbols-outlined text-[16px]">thumb_up</span>
            </button>
            <button className="p-1 text-stone/50 hover:text-charcoal rounded transition-colors" title="没帮助">
              <span className="material-symbols-outlined text-[16px]">thumb_down</span>
            </button>
          </div>
        </div>
      )}
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
