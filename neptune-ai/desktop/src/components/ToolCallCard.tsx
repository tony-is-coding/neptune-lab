import type { ChatMessage } from '../types';

interface ToolCallCardProps {
  message: ChatMessage;
}

/**
 * 工具调用卡片
 */
export function ToolCallCard({ message }: ToolCallCardProps) {
  if (message.type !== 'tool_use' && message.type !== 'tool_result') {
    return null;
  }

  const isToolUse = message.type === 'tool_use';
  const toolName = message.name || 'Unknown';

  return (
    <div
      className={`border-l-4 ${
        isToolUse ? 'border-blue-500 bg-blue-50' : 'border-green-500 bg-green-50'
      } rounded-r-lg p-3 mb-2`}
    >
      <div className="flex items-center gap-2">
        {isToolUse ? (
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
        ) : (
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
        )}
        <span className="text-sm font-medium">
          {isToolUse ? '正在调用' : '已完成'}: {toolName}
        </span>
      </div>
      {(message.input || message.output) && (
        <details className="mt-2">
          <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-800">
            {isToolUse ? '输入参数' : '返回结果'}
          </summary>
          <pre className="text-xs bg-white p-2 rounded mt-1 overflow-auto max-h-32">
            {JSON.stringify(isToolUse ? message.input : message.output, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
