import type { AgentTemplate } from '../../types/chat';

interface AgentWelcomeViewProps {
  agent: AgentTemplate;
  onSendMessage: (message: string) => void;
}

/**
 * 根据 Agent 描述生成建议消息
 */
function getSuggestedPrompts(description: string | null): string[] {
  const desc = description?.toLowerCase() || '';

  if (desc.includes('code') || desc.includes('review') || desc.includes('debug')) {
    return [
      'Review this code',
      'Security audit',
      'Help me debug',
    ];
  }

  if (desc.includes('market') || desc.includes('analysis') || desc.includes('report')) {
    return [
      'Analyze market trends',
      'Generate a report',
      'Summarize findings',
    ];
  }

  if (desc.includes('data') || desc.includes('research')) {
    return [
      'Help me research this topic',
      'Summarize these findings',
      'What insights can you find?',
    ];
  }

  // 默认建议
  return [
    'Help me get started',
    'What can you do?',
  ];
}

/**
 * B1: Agent 欢迎卡片
 * 显示条件：有 Agent 但零对话（threads.length === 0）
 */
export function AgentWelcomeView({ agent, onSendMessage }: AgentWelcomeViewProps) {
  const suggestedPrompts = getSuggestedPrompts(agent.description);

  return (
    <div className="flex-1 flex flex-col items-center justify-center h-full px-6 relative z-0">
      <div className="text-center max-w-[480px]">
        {/* Agent 头像 */}
        <div className="w-16 h-16 rounded-xl bg-surface-container-low flex items-center justify-center border border-border-cream mx-auto mb-4">
          <span className="material-symbols-outlined text-[32px] text-charcoal">
            {agent.icon || 'smart_toy'}
          </span>
        </div>

        {/* Agent 名称 */}
        <h2 className="font-serif text-[28px] text-charcoal leading-tight mb-1">
          {agent.name}
        </h2>

        {/* Agent 描述 */}
        <p className="text-sm text-stone leading-relaxed mb-8">
          {agent.description || 'Ready to collaborate with you.'}
        </p>

        {/* 建议消息 */}
        {suggestedPrompts.length > 0 && (
          <>
            <p className="text-[12px] text-stone font-semibold mb-3">
              Try asking:
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {suggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => onSendMessage(prompt)}
                  className="px-4 py-2 rounded-full border border-border-cream text-sm text-charcoal hover:bg-surface-container-highest transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
