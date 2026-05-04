import type { ChatMessage } from '../types';

interface MessageBubbleProps {
  message: ChatMessage;
}

/**
 * 聊天消息气泡
 */
export function MessageBubble({ message }: MessageBubbleProps) {
  const renderContent = () => {
    switch (message.type) {
      case 'text':
        return (
          <div className="prose prose-sm max-w-none">
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
        );

      case 'tool_use':
        return (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-blue-900">
                正在调用工具: {message.name}
              </span>
            </div>
            {message.input && (
              <pre className="text-xs bg-blue-100 p-2 rounded overflow-auto">
                {JSON.stringify(message.input, null, 2)}
              </pre>
            )}
          </div>
        );

      case 'tool_result':
        return (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm font-medium text-green-900">
                工具返回: {message.name}
              </span>
            </div>
            {message.output && (
              <pre className="text-xs bg-green-100 p-2 rounded overflow-auto max-h-40">
                {JSON.stringify(message.output, null, 2)}
              </pre>
            )}
          </div>
        );

      case 'error':
        return (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span className="text-sm font-medium text-red-900">错误</span>
            </div>
            <p className="text-sm text-red-700">{message.error}</p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="mb-4">
      {renderContent()}
    </div>
  );
}
