import { useState } from 'react';
import type { MessageBlock } from '../../types/chat';

interface ToolUseBlockProps {
  block: Extract<MessageBlock, { type: 'tool_use' }>;
  toolResult?: Extract<MessageBlock, { type: 'tool_result' }>;
}

export function ToolUseBlock({ block, toolResult }: ToolUseBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isRunning = block.status === 'running';
  const isCompleted = block.status === 'completed';
  const isError = block.status === 'error';

  return (
    <div className="border border-border-cream rounded-[10px] overflow-hidden">
      <div
        className="px-3.5 py-2.5 bg-ivory flex items-center gap-2 cursor-pointer hover:bg-surface-container transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Status indicator */}
        <div className={`w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0 ${
          isRunning ? 'bg-stone' :
          isCompleted ? 'bg-success' :
          'bg-error'
        }`}>
          {isRunning && <span className="text-white text-[6px] tracking-[1px]">●●●</span>}
          {isCompleted && <span className="text-white text-[10px] font-bold">✓</span>}
          {isError && <span className="text-white text-[10px]">✕</span>}
        </div>

        <span className="text-[12px] font-semibold text-charcoal">{block.name}</span>
        {block.input?._summary && (
          <span className="text-[11px] text-stone">— {String(block.input._summary)}</span>
        )}
        {isCompleted && toolResult?.output?._summary && (
          <span className="text-[11px] text-stone">— {String(toolResult.output._summary)}</span>
        )}

        <span className={`text-stone/50 text-[10px] ml-auto transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
      </div>

      {isExpanded && (
        <div className="px-3.5 py-3 border-t border-border-cream/50 bg-surface-lowest">
          {block.input && (
            <div className="mb-2">
              <div className="text-[10px] font-bold text-stone uppercase tracking-wider mb-1">Input</div>
              <pre className="text-[11px] text-charcoal/80 bg-ivory rounded-lg p-3 overflow-x-auto leading-relaxed">
                {JSON.stringify(block.input, null, 2)}
              </pre>
            </div>
          )}
          {toolResult?.output && (
            <div>
              <div className="text-[10px] font-bold text-stone uppercase tracking-wider mb-1">Output</div>
              <pre className="text-[11px] text-charcoal/80 bg-ivory rounded-lg p-3 overflow-x-auto leading-relaxed">
                {JSON.stringify(toolResult.output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
