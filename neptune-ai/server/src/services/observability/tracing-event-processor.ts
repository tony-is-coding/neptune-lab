/**
 * TracingEventProcessor — SDK 事件流的 Tracing 处理器
 *
 * 职责单一：消费 SDK 事件流，自动维护 turn/round 状态机，向 Langfuse 上报嵌套层级链路。
 * ThreadManager 只需调用 processor.process(event) 即可。
 *
 * 层级结构：
 * Trace: query
 * └── Turn Span (整个 agentic loop)
 *     ├── Round 1 (一次 LLM 推理循环)
 *     │   ├── reasoning (思考过程)
 *     │   ├── generation: llm-call (LLM API 调用)
 *     │   └── tool: WebSearch (工具执行)
 *     ├── Round 2
 *     │   ├── reasoning
 *     │   ├── generation: llm-call
 *     │   └── tool: Read
 *     └── Round 3
 *         ├── reasoning
 *         └── generation: llm-call (最终回答)
 *
 * 状态机：
 * 1. 构造时 → 创建 trace + 开始 turn span
 * 2. 收到 stream_event → 开始 round（如果还没开始）+ 累积内容
 * 3. 收到 assistant → 记录 reasoning + generation + tools → 结束 round
 * 4. 下一个 stream_event → 开始新 round
 * 5. end() → 结束 turn + 结束 trace
 */

import { LangfuseTracingProvider } from './langfuse-tracing-provider.js';

/**
 * Processor 配置
 */
export interface TracingProcessorConfig {
  provider: LangfuseTracingProvider;
  model: string;
  threadId: string;
  userId: string;
  tenantId: string;
  agentId: string;
  userInput: string;
}

/**
 * TracingEventProcessor
 */
export class TracingEventProcessor {
  private provider: LangfuseTracingProvider;
  private model: string;
  private userInput: string;
  private config: TracingProcessorConfig;

  // Turn/Round 状态
  private roundIndex = 0;
  private roundActive = false;
  private currentTurnText = '';
  private currentTurnThinking = '';
  private currentTurnThinkingStartTime = 0;
  private currentTurnToolUses: Array<{ name: string; input: unknown }> = [];
  private currentRoundStartTime: number;

  // Tool 状态（兼容独立 tool_use/tool_result 事件）
  private pendingToolCalls = new Map<string, { name: string; input: unknown; startTime: number }>();

  // Messages 上下文
  private messagesContext: Array<{ role: string; content: unknown }> = [];

  // 输出收集
  private _assistantOutput = '';

  constructor(config: TracingProcessorConfig) {
    this.provider = config.provider;
    this.model = config.model;
    this.userInput = config.userInput;
    this.config = config;
    this.currentRoundStartTime = performance.now();

    // 初始化 trace
    this.provider.setTraceContext({
      name: 'query',
      sessionId: config.threadId,
      userId: config.userId,
      input: config.userInput,
      metadata: { agentId: config.agentId, tenantId: config.tenantId },
    });

    // 开始 turn span
    this.provider.startTurn('turn', {
      agentId: config.agentId,
      model: config.model,
    });

    // 初始化 messages 上下文
    this.messagesContext.push({ role: 'user', content: config.userInput });
  }

  /**
   * 处理单个 SDK 事件
   */
  process(event: unknown): void {
    const e = event as Record<string, unknown>;
    const eventType = e.type as string;

    switch (eventType) {
      case 'stream_event':
        this.handleStreamEvent(e);
        break;
      case 'assistant':
        this.handleAssistant(e);
        break;
      case 'tool_use':
        this.handleToolUse(e);
        break;
      case 'tool_result':
        this.handleToolResult(e);
        break;
    }
  }

  /**
   * 结束 trace
   */
  end(usage?: {
    modelUsage?: Record<string, {
      inputTokens: number;
      outputTokens: number;
      cacheReadInputTokens: number;
      cacheCreationInputTokens: number;
      costUSD: number;
    }>;
  }, durationMs?: number): void {
    // 结束可能未关闭的 round
    if (this.roundActive) {
      this.provider.endRound();
      this.roundActive = false;
    }

    // 结束 turn
    this.provider.endTurn();

    // 更新 trace metadata
    if (usage?.modelUsage) {
      const totalUsage: Record<string, unknown> = {};
      for (const [model, mu] of Object.entries(usage.modelUsage)) {
        totalUsage[model] = {
          inputTokens: mu.inputTokens,
          outputTokens: mu.outputTokens,
          cacheReadInputTokens: mu.cacheReadInputTokens,
          cacheCreationInputTokens: mu.cacheCreationInputTokens,
          costUSD: mu.costUSD,
        };
      }
      this.provider.updateTraceMetadata({
        totalRounds: this.roundIndex,
        totalUsage,
        durationMs,
      });
    }

    this.provider.endTrace(this._assistantOutput || undefined);
  }

  /**
   * 错误时结束 trace
   */
  endWithError(): void {
    if (this.roundActive) {
      this.provider.endRound();
    }
    this.provider.endTurn();
    this.provider.endTrace();
  }

  /**
   * 获取收集到的 assistant 输出文本
   */
  get assistantOutput(): string {
    return this._assistantOutput;
  }

  // ===== 内部方法 =====

  /**
   * 确保 round 已开始
   */
  private ensureRoundStarted(): void {
    if (!this.roundActive) {
      this.roundIndex++;
      this.currentRoundStartTime = performance.now();
      this.provider.startRound(`round-${this.roundIndex}`, {
        roundIndex: this.roundIndex,
      });
      this.roundActive = true;
    }
  }

  private handleStreamEvent(event: Record<string, unknown>): void {
    const innerEvent = event.event as Record<string, unknown> | undefined;
    if (!innerEvent) return;

    if (innerEvent.type === 'content_block_delta') {
      const delta = innerEvent.delta as Record<string, unknown> | undefined;
      if (!delta) return;

      if (delta.type === 'text_delta' && delta.text) {
        this.ensureRoundStarted();
        this._assistantOutput += delta.text as string;
        this.currentTurnText += delta.text as string;
      } else if (delta.type === 'thinking_delta' && delta.thinking) {
        this.ensureRoundStarted();
        if (!this.currentTurnThinkingStartTime) {
          this.currentTurnThinkingStartTime = performance.now();
        }
        this.currentTurnThinking += delta.thinking as string;
      }
    } else if (innerEvent.type === 'content_block_start') {
      const contentBlock = innerEvent.content_block as Record<string, unknown> | undefined;
      if (contentBlock?.type === 'thinking') {
        this.ensureRoundStarted();
        if (!this.currentTurnThinkingStartTime) {
          this.currentTurnThinkingStartTime = performance.now();
        }
        if (contentBlock.thinking) {
          this.currentTurnThinking += contentBlock.thinking as string;
        }
      }
    }
  }

  private handleAssistant(event: Record<string, unknown>): void {
    // 确保 round 已开始（edge case：assistant 事件直接到达）
    this.ensureRoundStarted();

    const msg = event.message as Record<string, unknown> | undefined;
    if (msg?.content && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block.type === 'text' && block.text) {
          if (!this.currentTurnText) {
            this.currentTurnText = block.text;
            this._assistantOutput = block.text;
          }
        }
        if (block.type === 'tool_use') {
          this.currentTurnToolUses.push({ name: block.name, input: block.input });
        }
      }
    }

    const roundDuration = Math.round(performance.now() - this.currentRoundStartTime);

    // 1. Reasoning span（嵌套在 round 下）
    if (this.currentTurnThinking) {
      const thinkingDuration = this.currentTurnThinkingStartTime
        ? Math.round(performance.now() - this.currentTurnThinkingStartTime)
        : roundDuration;
      this.provider.thinkingSpan({
        content: this.currentTurnThinking,
        turnIndex: this.roundIndex,
        durationMs: thinkingDuration,
      });
    }

    // 2. Generation（嵌套在 round 下）
    this.provider.generation({
      name: `llm-turn-${this.roundIndex}`,
      model: this.model,
      input: this.formatGenerationInput(),
      output: this.formatGenerationOutput(),
      usage: { inputTokens: 0, outputTokens: 0 },
      latencyMs: roundDuration,
      metadata: {
        roundIndex: this.roundIndex,
        hasThinking: !!this.currentTurnThinking,
        toolCalls: this.currentTurnToolUses.map(t => t.name),
      },
    });

    // 3. Tool spans（嵌套在 round 下）
    for (const tu of this.currentTurnToolUses) {
      this.provider.toolSpan({
        name: tu.name,
        input: tu.input,
        output: '(result in next round context)',
        durationMs: 0,
        status: 'ok',
      });
    }

    // 累积到 messages 上下文
    const assistantBlocks: unknown[] = [];
    if (this.currentTurnText) {
      assistantBlocks.push({ type: 'text', text: this.currentTurnText });
    }
    for (const tu of this.currentTurnToolUses) {
      assistantBlocks.push({ type: 'tool_use', name: tu.name, input: tu.input });
    }
    this.messagesContext.push({ role: 'assistant', content: assistantBlocks });

    // 结束当前 round
    this.provider.endRound();
    this.roundActive = false;

    // 重置 round 状态
    this.currentTurnText = '';
    this.currentTurnThinking = '';
    this.currentTurnThinkingStartTime = 0;
    this.currentTurnToolUses = [];
  }

  private handleToolUse(event: Record<string, unknown>): void {
    const toolId = String(event.id || '');
    const toolName = String(event.name || '');
    const toolInput = event.input || {};
    this.pendingToolCalls.set(toolId, {
      name: toolName,
      input: toolInput,
      startTime: performance.now(),
    });
  }

  private handleToolResult(event: Record<string, unknown>): void {
    const toolUseId = String(event.toolUseId || event.tool_use_id || '');
    const toolOutput = event.content ?? event.output ?? '';
    const isError = Boolean(event.isError);
    const pending = this.pendingToolCalls.get(toolUseId);

    if (pending) {
      this.ensureRoundStarted();
      const toolDuration = Math.round(performance.now() - pending.startTime);
      this.provider.toolSpan({
        name: pending.name,
        input: pending.input,
        output: typeof toolOutput === 'string' ? toolOutput.substring(0, 2000) : toolOutput,
        durationMs: toolDuration,
        status: isError ? 'error' : 'ok',
      });
      this.pendingToolCalls.delete(toolUseId);
    }

    // 累积 tool_result 到 messages 上下文
    const outputStr = typeof toolOutput === 'string'
      ? toolOutput.substring(0, 1000)
      : JSON.stringify(toolOutput).substring(0, 1000);
    this.messagesContext.push({
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: toolUseId, content: outputStr }],
    });
  }

  // ===== 格式化方法 =====

  private formatGenerationInput(): string {
    const sections: string[] = [];

    sections.push(`## Session Context\n\n\`\`\`json\n${JSON.stringify({
      session_id: this.config.threadId,
      user_id: this.config.userId,
      tenant_id: this.config.tenantId,
      agent_id: this.config.agentId,
      model: this.model,
      round_index: this.roundIndex,
    }, null, 2)}\n\`\`\``);

    sections.push(`## User Input\n\n${this.userInput}`);

    if (this.messagesContext.length > 1) {
      const recentMessages = this.messagesContext.length <= 6
        ? this.messagesContext
        : this.messagesContext.slice(-6);

      const formatted = recentMessages.map(m => {
        const content = typeof m.content === 'string'
          ? m.content
          : JSON.stringify(m.content, null, 2);
        return `**${m.role}**: ${content.substring(0, 500)}`;
      }).join('\n\n');

      sections.push(`## Messages Context (${recentMessages.length} messages)\n\n${formatted}`);
    }

    return sections.join('\n\n---\n\n');
  }

  private formatGenerationOutput(): string {
    const sections: string[] = [];

    if (this.currentTurnText) {
      sections.push(`## Response\n\n${this.currentTurnText}`);
    }

    if (this.currentTurnThinking) {
      const preview = this.currentTurnThinking.length > 3000
        ? this.currentTurnThinking.substring(0, 3000) + '\n\n... [truncated]'
        : this.currentTurnThinking;
      sections.push(`## Reasoning\n\n${preview}`);
    }

    if (this.currentTurnToolUses.length > 0) {
      const toolsFormatted = this.currentTurnToolUses.map(t => {
        const inputStr = JSON.stringify(t.input, null, 2);
        return `### ${t.name}\n\n\`\`\`json\n${inputStr.substring(0, 1000)}\n\`\`\``;
      }).join('\n\n');
      sections.push(`## Tool Calls\n\n${toolsFormatted}`);
    }

    return sections.join('\n\n---\n\n') || '(no output)';
  }
}
